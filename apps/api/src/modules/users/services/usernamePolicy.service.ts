import { randomInt } from "node:crypto";

import { ConflictError, TooManyRequestsError } from "@zudojs/errors";

import type { AppSettings } from "../../../configs/settings.config.js";
import { SYSTEM_RESERVED_USERNAME_RULES, type ReservedUsernameRule } from "../../../constants/reservedUsernames.constant.js";
import { unprocessable } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import { holdIsActiveAt, type UsernameAvailability, type UsernameChangeRecord, type UsernamePolicySummary, type UsernameUnavailableReason } from "../models/usernames.model.js";
import type { UsernamesRepository } from "../repositories/usernames.repository.js";
import type { UsersRepository } from "../repositories/users.repository.js";
import { buildUsernameBaseFromSeed, findMatchingReservedRule, normalizeRequestedUsername, usernameHasValidFormat } from "./usernameRules.service.js";

const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;

const UNAVAILABLE_MESSAGES: Readonly<Record<UsernameUnavailableReason, string>> = {
  taken: "This username is taken.",
  reserved: "This username is reserved.",
  invalid: "Usernames are 3-30 lowercase letters, numbers, dots or underscores, include a letter, and cannot start or end with a dot or use two dots in a row.",
  recently_used: "This username was used recently and is not available yet.",
  withheld: "This username is not available.",
};

export class UsernameChangeTooSoonError extends TooManyRequestsError {
  public constructor(public readonly nextChangeAvailableAt: Date) {
    super("You changed your username recently. Try again later.");
  }
}

export class UsernamePolicyService {
  public constructor(
    private readonly users: UsersRepository,
    public readonly usernames: UsernamesRepository,
    private readonly clock: Clock,
    public readonly settings: AppSettings["usernames"],
  ) {}

  public async listReservedRules(): Promise<readonly ReservedUsernameRule[]> {
    const custom = await this.usernames.listReservedUsernames();
    return [...SYSTEM_RESERVED_USERNAME_RULES, ...custom.map((entry) => ({ term: entry.term, matchKind: entry.matchKind }))];
  }

  public async checkAvailability(requested: string, requesterId?: string): Promise<UsernameAvailability> {
    const username = normalizeRequestedUsername(requested);
    if (findMatchingReservedRule(username, await this.listReservedRules()) !== undefined) return { available: false, reason: "reserved" };
    if (!usernameHasValidFormat(username)) return { available: false, reason: "invalid" };
    const hold = await this.usernames.findHold(username);
    if (hold !== undefined && holdIsActiveAt(hold, this.clock.now())) {
      if (hold.kind === "withheld") return { available: false, reason: "withheld" };
      if (hold.heldForUserId !== requesterId) return { available: false, reason: "recently_used" };
    }
    const owner = await this.users.findByUsername(username);
    if (owner !== undefined && owner.id !== requesterId) return { available: false, reason: "taken" };
    return { available: true };
  }

  public async requireAvailableUsername(requested: string, requesterId?: string): Promise<string> {
    const availability = await this.checkAvailability(requested, requesterId);
    if (availability.reason === "taken") throw new ConflictError(UNAVAILABLE_MESSAGES.taken);
    if (availability.reason !== undefined) throw unprocessable(UNAVAILABLE_MESSAGES[availability.reason]);
    return normalizeRequestedUsername(requested);
  }

  public async generateAvailableUsername(seeds: readonly (string | null | undefined)[]): Promise<string> {
    const rules = await this.listReservedRules();
    const bases = seeds
      .map((seed) => buildUsernameBaseFromSeed(seed ?? ""))
      .filter((base) => base.length >= 3 && /[a-z]/.test(base) && findMatchingReservedRule(base, rules) === undefined);
    const base = bases[0] ?? "user";
    for (const digits of [3, 3, 3, 3, 4, 4, 4, 6, 6, 8]) {
      const candidate = `${base}${randomInt(10 ** (digits - 1), 10 ** digits)}`;
      if ((await this.checkAvailability(candidate)).available) return candidate;
    }
    return `user${randomInt(10 ** 9, 10 ** 10)}`;
  }

  public async calculateNextChangeAvailableAt(userId: string): Promise<Date | null> {
    const now = this.clock.now();
    const userChanges = (await this.usernames.listChangesForUser(userId)).filter((change) => change.reason === "user_change");
    const candidates: number[] = [];
    const latest = userChanges[0];
    if (latest !== undefined) candidates.push(latest.createdAt.getTime() + this.settings.changeCooldownDays * DAY_MS);
    const withinYear = userChanges.filter((change) => now.getTime() - change.createdAt.getTime() < YEAR_MS);
    if (withinYear.length >= this.settings.maxChangesPerYear) {
      const oldestCounted = withinYear[this.settings.maxChangesPerYear - 1] as UsernameChangeRecord;
      candidates.push(oldestCounted.createdAt.getTime() + YEAR_MS);
    }
    const next = Math.max(0, ...candidates);
    return next > now.getTime() ? new Date(next) : null;
  }

  public async describePolicy(userId: string, username: string): Promise<UsernamePolicySummary> {
    const now = this.clock.now();
    const changes = await this.usernames.listChangesForUser(userId);
    const nextChangeAvailableAt = await this.calculateNextChangeAvailableAt(userId);
    const usedThisYear = changes.filter((change) => change.reason === "user_change" && now.getTime() - change.createdAt.getTime() < YEAR_MS).length;
    const { changeCooldownDays, maxChangesPerYear, quarantineDays } = this.settings;
    return {
      username,
      canChangeNow: nextChangeAvailableAt === null,
      nextChangeAvailableAt: nextChangeAvailableAt?.toISOString() ?? null,
      changesRemainingThisYear: Math.max(0, maxChangesPerYear - usedThisYear),
      cooldownDays: changeCooldownDays,
      maxChangesPerYear,
      quarantineDays,
      rules: [
        "Usernames are 3-30 characters: lowercase letters, numbers, dots and underscores, with at least one letter.",
        "A username cannot start or end with a dot or contain two dots in a row.",
        `You can change your username once every ${changeCooldownDays} days, up to ${maxChangesPerYear} times a year.`,
        `Your previous username is held for ${quarantineDays} days before anyone else can claim it.`,
        "Names that impersonate people, brands or Zudomart are not allowed, and Zudomart may reclaim a username that breaks the Terms.",
      ],
      history: changes.map((change) => ({ from: change.previousUsername, to: change.newUsername, changedAt: change.createdAt.toISOString(), reason: change.reason })),
    };
  }

  public async quarantinePreviousUsername(previousUsername: string, userId: string): Promise<void> {
    const now = this.clock.now();
    await this.usernames.saveHold({
      username: previousUsername,
      kind: "quarantine",
      heldForUserId: userId,
      reason: "released",
      note: "",
      createdById: null,
      expiresAt: new Date(now.getTime() + this.settings.quarantineDays * DAY_MS),
      createdAt: now,
    });
  }
}
