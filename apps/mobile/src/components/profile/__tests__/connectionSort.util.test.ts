import type { ConnectionEntry } from "@/types/account.type";

import { sortAndFilterConnections } from "../connectionSort.util";

const entry = (id: string, name: string, isFollowing: boolean, followsYou: boolean, mutualConnections: number): ConnectionEntry => ({
  id, name, username: id, avatarUrl: null, verified: false, isFollowing, followsYou, mutualConnections,
});

const people = [entry("c", "chidi", true, false, 2), entry("a", "Ada", true, true, 9), entry("b", "Bola", false, true, 5)];

describe("sortAndFilterConnections", () => {
  it("keeps server order by default", () => expect(sortAndFilterConnections(people, "recent", "all").map((p) => p.id)).toEqual(["c", "a", "b"]));
  it("sorts by name ignoring case", () => expect(sortAndFilterConnections(people, "name", "all").map((p) => p.id)).toEqual(["a", "b", "c"]));
  it("sorts by most mutual", () => expect(sortAndFilterConnections(people, "mutual", "all").map((p) => p.id)).toEqual(["a", "b", "c"]));
  it("filters following, followers and mutual", () => {
    expect(sortAndFilterConnections(people, "recent", "following").map((p) => p.id)).toEqual(["c", "a"]);
    expect(sortAndFilterConnections(people, "recent", "followers").map((p) => p.id)).toEqual(["a", "b"]);
    expect(sortAndFilterConnections(people, "recent", "mutual").map((p) => p.id)).toEqual(["a"]);
  });
});
