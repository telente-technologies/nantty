import type { ChatControl, ChatLocation, ChatPoll } from "./richContent";

export interface ControlEntry {
  readonly id: string;
  readonly senderId: string;
  readonly createdAt?: string;
  readonly control: ChatControl;
}

export interface ReactionTally {
  readonly emoji: string;
  readonly count: number;
  readonly reactedByMe: boolean;
  readonly userIds: readonly string[];
}

export interface PollOptionTally {
  readonly id: string;
  readonly text: string;
  readonly voteCount: number;
  readonly votedByMe: boolean;
}

export interface LiveLocationState extends ChatLocation {
  readonly updatedAt: string | null;
  readonly stopped: boolean;
}

interface TargetState {
  readonly reactions: Map<string, Set<string>>;
  readonly votes: Map<string, readonly string[]>;
  readonly locations: { senderId: string; latitude: number; longitude: number; label: string | null; at: string | null }[];
  readonly stoppedBy: Map<string, string | null>;
}

export class ChatControlLedger {
  private readonly targets = new Map<string, TargetState>();
  private readonly seen = new Set<string>();

  public static from(entries: readonly ControlEntry[]): ChatControlLedger {
    const ledger = new ChatControlLedger();
    ledger.apply(entries);
    return ledger;
  }

  public apply(entries: readonly ControlEntry[]): void {
    const ordered = [...entries].filter((entry) => !this.seen.has(entry.id)).sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? "") || left.id.localeCompare(right.id));
    for (const entry of ordered) {
      this.seen.add(entry.id);
      const control = entry.control;
      if (control.type === "groupUpdate") continue;
      const target = this.target(control.targetMessageId);
      if (control.type === "reaction") {
        const users = target.reactions.get(control.emoji) ?? new Set<string>();
        if (control.remove) users.delete(entry.senderId);
        else users.add(entry.senderId);
        target.reactions.set(control.emoji, users);
      } else if (control.type === "pollVote") {
        target.votes.set(entry.senderId, control.optionIds);
      } else if (control.type === "locationUpdate") {
        target.locations.push({ senderId: entry.senderId, latitude: control.latitude, longitude: control.longitude, label: control.label, at: entry.createdAt ?? null });
      } else {
        target.stoppedBy.set(entry.senderId, entry.createdAt ?? null);
      }
    }
  }

  private target(messageId: string): TargetState {
    let state = this.targets.get(messageId);
    if (state === undefined) {
      state = { reactions: new Map(), votes: new Map(), locations: [], stoppedBy: new Map() };
      this.targets.set(messageId, state);
    }
    return state;
  }

  public reactions(messageId: string, viewerId: string): ReactionTally[] {
    const state = this.targets.get(messageId);
    if (state === undefined) return [];
    return [...state.reactions].filter(([, users]) => users.size > 0).map(([emoji, users]) => ({ emoji, count: users.size, reactedByMe: users.has(viewerId), userIds: [...users] }));
  }

  public myReactions(messageId: string, viewerId: string): string[] {
    return this.reactions(messageId, viewerId).filter((tally) => tally.reactedByMe).map((tally) => tally.emoji);
  }

  public poll(messageId: string, poll: ChatPoll, viewerId: string): PollOptionTally[] {
    const counts = new Map(poll.options.map((option) => [option.id, 0]));
    const mine = new Set<string>();
    for (const [userId, optionIds] of this.targets.get(messageId)?.votes ?? []) {
      const valid = optionIds.filter((optionId) => counts.has(optionId));
      for (const optionId of poll.allowMultipleAnswers ? valid : valid.slice(0, 1)) {
        counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
        if (userId === viewerId) mine.add(optionId);
      }
    }
    return poll.options.map((option) => ({ id: option.id, text: option.text, voteCount: counts.get(option.id) ?? 0, votedByMe: mine.has(option.id) }));
  }

  public myVote(messageId: string, viewerId: string): readonly string[] {
    return this.targets.get(messageId)?.votes.get(viewerId) ?? [];
  }

  public liveLocation(messageId: string, ownerId: string, base: ChatLocation, sentAt: string | null, now: Date): LiveLocationState {
    const state = this.targets.get(messageId);
    const latest = state?.locations.filter((update) => update.senderId === ownerId).at(-1);
    const liveUntil = base.liveUntil ?? null;
    const stopped = state?.stoppedBy.has(ownerId) === true || liveUntil === null || Date.parse(liveUntil) <= now.getTime();
    const location = latest === undefined ? base : { ...base, latitude: latest.latitude, longitude: latest.longitude, label: latest.label ?? base.label };
    return { ...location, liveUntil, updatedAt: latest?.at ?? sentAt, stopped };
  }
}

export function nextPollVote(current: readonly string[], optionId: string, allowMultipleAnswers: boolean): string[] {
  if (current.includes(optionId)) return current.filter((candidate) => candidate !== optionId);
  return allowMultipleAnswers ? [...current, optionId] : [optionId];
}
