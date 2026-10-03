import { ApiError } from "@/errors/api.error";
import type { UsernameAvailability, UsernamePolicy, UsernameUnavailableReason } from "@/types/account.type";
import { isValidUsername } from "@/utils/validators.util";

import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { directoryUsers } from "./userDirectory.mock";
import { applyProfileEditForSignedInUser, signedInProfile } from "./users.mock";

const DAY_IN_MS = 86_400_000;
const DAYS_BETWEEN_USERNAME_CHANGES = 30;
const CHANGES_ALLOWED_PER_YEAR = 3;

const EXACT_ONLY_RESERVED_USERNAMES = new Set(["all"]);
const RESERVED_USERNAMES = new Set(["admin", "support", "zudomart", "official", "help", "security", "verify", "payments", "escrow", "staff", "moderator", "root", "billing", "news"]);
const WITHHELD_USERNAMES = new Set(["lagosstategovt", "cbn", "efcc"]);
const RECENTLY_RELEASED_USERNAMES = new Set(["enyodev", "mayweda_dev"]);

const usernameChangesByUserId = new Map<string, number[]>([["u_me", [Date.now() - 200 * DAY_IN_MS]]]);

export const generateAutomaticUsername = (seed: string) => {
  const letters = seed.split("@")[0]!.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12) || "zudo";
  return `${letters}${Math.floor(100 + Math.random() * 900)}`;
};

const takenUsernames = () => new Set([...directoryUsers.map((user) => user.username.toLowerCase()), "taken", signedInProfile().username.toLowerCase()]);

const UNAVAILABLE_MESSAGES: Record<UsernameUnavailableReason, string> = {
  invalid: "Use 3 to 20 letters, numbers, underscores or full stops.",
  reserved: "This username is reserved.",
  withheld: "This username is restricted and can't be used.",
  recently_used: "This username was used recently and isn't available yet.",
  taken: "This username is already taken.",
};

const unavailable = (reason: UsernameUnavailableReason): UsernameAvailability => ({ available: false, reason, message: UNAVAILABLE_MESSAGES[reason] });

export function checkAvailability(rawUsername: string): UsernameAvailability {
  const username = rawUsername.trim().toLowerCase();
  if (!isValidUsername(username)) return unavailable("invalid");
  if (EXACT_ONLY_RESERVED_USERNAMES.has(username.toLowerCase())) return unavailable("reserved");
  if ([...RESERVED_USERNAMES].some((reserved) => username === reserved || username.startsWith(`${reserved}.`) || username.startsWith(`${reserved}_`))) return unavailable("reserved");
  if (WITHHELD_USERNAMES.has(username)) return unavailable("withheld");
  if (RECENTLY_RELEASED_USERNAMES.has(username)) return unavailable("recently_used");
  if (takenUsernames().has(username)) return unavailable("taken");
  return { available: true };
}

export const buildUsernameUnavailableError = (availability: UsernameAvailability) => {
  const message = availability.message ?? "That username isn't available";
  if (availability.reason === "taken") return new ApiError(409, message, "USERNAME_TAKEN");
  return new ApiError(422, message, availability.reason === "invalid" ? "USERNAME_INVALID" : "USERNAME_UNAVAILABLE");
};

function buildPolicy(): UsernamePolicy {
  const changes = usernameChangesByUserId.get(getSignedInMockUser().id) ?? [];
  const changesInLastYear = changes.filter((time) => Date.now() - time < 365 * DAY_IN_MS);
  const lastChange = Math.max(0, ...changes);
  const nextAllowed = lastChange + DAYS_BETWEEN_USERNAME_CHANGES * DAY_IN_MS;
  const remaining = Math.max(0, CHANGES_ALLOWED_PER_YEAR - changesInLastYear.length);
  return {
    username: signedInProfile().username,
    canChangeNow: remaining > 0 && Date.now() >= nextAllowed,
    nextChangeAvailableAt: Date.now() >= nextAllowed ? null : new Date(nextAllowed).toISOString(),
    changesRemainingThisYear: remaining,
    cooldownDays: DAYS_BETWEEN_USERNAME_CHANGES,
    maxChangesPerYear: CHANGES_ALLOWED_PER_YEAR,
    quarantineDays: 14,
    history: [],
    rules: [
      `You can change your username once every ${DAYS_BETWEEN_USERNAME_CHANGES} days, up to ${CHANGES_ALLOWED_PER_YEAR} times a year.`,
      "Your old username is held for 14 days so nobody can pretend to be you.",
      "Links to your old @username stop working after the change.",
    ],
  };
}

export const usernameMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/auth/username-available", ({ query }) => checkAvailability(query.get("username") ?? "")),
  createMockRoute("GET", "/api/v1/auth/username-suggestion", ({ query }) => {
    let suggestion = generateAutomaticUsername(query.get("seed") ?? "zudo");
    while (!checkAvailability(suggestion).available) suggestion = generateAutomaticUsername(query.get("seed") ?? "zudo");
    return { username: suggestion };
  }),
  createMockRoute("GET", "/api/v1/users/me/username-policy", () => buildPolicy()),
  createMockRoute("PATCH", "/api/v1/users/me/username", ({ body }) => {
    const { username } = body as { username: string };
    const policy = buildPolicy();
    if (!policy.canChangeNow) {
      throw new ApiError(429, `You can change your username again on ${new Date(policy.nextChangeAvailableAt ?? Date.now()).toDateString()}.`, "USERNAME_CHANGE_TOO_SOON");
    }
    const availability = checkAvailability(username);
    if (!availability.available) throw buildUsernameUnavailableError(availability);
    const userId = getSignedInMockUser().id;
    usernameChangesByUserId.set(userId, [...(usernameChangesByUserId.get(userId) ?? []), Date.now()]);
    applyProfileEditForSignedInUser({ username: username.trim().toLowerCase() });
    return signedInProfile();
  }),
];
