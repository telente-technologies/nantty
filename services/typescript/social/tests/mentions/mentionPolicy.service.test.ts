import { describe, expect, it } from "vitest";

import type { MentionEntity } from "../../src/modules/mentions/models/mention.model.js";
import { applyMentionPolicy, type MentionLookups } from "../../src/modules/mentions/services/mentionPolicy.service.js";

const text = "hi @ada and @bob and @all";
const entities: MentionEntity[] = [
  { userId: "ada", username: "ada", start: 3, length: 4 },
  { userId: "bob", username: "bob", start: 12, length: 4 },
  { type: "all", start: 21, length: 4 },
];

const lookups = (overrides: Partial<MentionLookups> = {}): MentionLookups => ({
  usernameByUserId: new Map([["ada", "ada"], ["bob", "bob"]]),
  statusByUserId: new Map([["ada", "active"], ["bob", "active"]]),
  privacyByUserId: new Map(),
  userIdsWhoFollowAuthor: new Set(),
  blockedEitherWayUserIds: new Set(),
  groupMemberIds: new Set(["ada", "bob"]),
  authorGroupRole: "member",
  onlyAdminsCanMentionAll: false,
  ...overrides,
});

const run = (surface: "post" | "comment" | "group" | "direct", overrides: Partial<MentionLookups> = {}, input: MentionEntity[] = entities) =>
  applyMentionPolicy({ surface, authorId: "me", text, entities: input, lookups: lookups(overrides) });

describe("applyMentionPolicy", () => {
  it("keeps user mentions on posts and drops @all outside groups", () => {
    const result = run("post");
    expect(result.entities.map((entity) => ("userId" in entity ? entity.userId : "all"))).toEqual(["ada", "bob"]);
    expect(result.userIdsToNotify).toEqual(["ada", "bob"]);
    expect(result.mentionsAll).toBe(false);
  });
  it("allows @all in groups unless admins only", () => {
    expect(run("group").mentionsAll).toBe(true);
    expect(run("group", { onlyAdminsCanMentionAll: true }).mentionsAll).toBe(false);
    expect(run("group", { onlyAdminsCanMentionAll: true, authorGroupRole: "admin" }).mentionsAll).toBe(true);
  });
  it("limits group mentions to members", () => {
    const result = run("group", { groupMemberIds: new Set(["ada"]) });
    expect(result.userIdsToNotify).toEqual(["ada"]);
  });
  it("honours who can mention me", () => {
    const result = run("post", { privacyByUserId: new Map([["ada", "no_one"], ["bob", "following"]]) });
    expect(result.userIdsToNotify).toEqual([]);
    expect(run("post", { privacyByUserId: new Map([["bob", "following"]]), userIdsWhoFollowAuthor: new Set(["bob"]) }).userIdsToNotify).toEqual(["ada", "bob"]);
  });
  it("drops blocked, suspended and deleted targets", () => {
    const result = run("post", { blockedEitherWayUserIds: new Set(["ada"]), statusByUserId: new Map([["bob", "suspended"]]) });
    expect(result.entities).toEqual([]);
  });
  it("never notifies for one to one chats", () => {
    expect(run("direct").userIdsToNotify).toEqual([]);
  });
  it("drops out of bounds and overlapping entities", () => {
    const result = run("post", {}, [{ userId: "ada", username: "ada", start: 3, length: 40 }, { userId: "ada", username: "ada", start: 3, length: 4 }, { userId: "bob", username: "bob", start: 5, length: 4 }]);
    expect(result.entities).toHaveLength(1);
  });
  it("rejects more than 20 mentions", () => {
    const many = Array.from({ length: 21 }, (_, index) => ({ userId: "ada", username: "ada", start: index, length: 4 }));
    expect(() => run("post", {}, many)).toThrow(/at most 20/);
  });
  it("skips text bounds for encrypted messages", () => {
    const result = applyMentionPolicy({ surface: "group", authorId: "me", text: null, entities: [{ userId: "ada", username: "ada", start: 400, length: 4 }], lookups: lookups() });
    expect(result.userIdsToNotify).toEqual(["ada"]);
  });
});
