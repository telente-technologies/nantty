import assert from "node:assert/strict";
import test from "node:test";

import { commentableActingProfiles } from "./commentableActingProfiles.util";
import type { ActingProfile } from "@/types/brand.type";

const profile = (id: string, kind: ActingProfile["kind"], onHold?: boolean): ActingProfile => ({
  id,
  kind,
  name: id,
  handle: id,
  avatarUrl: null,
  verification: null,
  ...(onHold === undefined ? {} : { onHold }),
});

test("comment identity picker includes postable owned business profiles only", () => {
  const result = commentableActingProfiles([
    profile("person", "person"),
    profile("business", "business"),
    profile("brand", "brand"),
    profile("store", "store"),
    profile("held-store", "store", true),
    profile("government", "government"),
  ]);

  assert.deepEqual(result.map(({ id }) => id), ["business", "brand", "store"]);
});

test("undefined hold status remains eligible for older profile responses", () => {
  assert.deepEqual(commentableActingProfiles([profile("legacy-business", "business")]).map(({ id }) => id), ["legacy-business"]);
});
