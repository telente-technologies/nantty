import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { GroupAttributes } from "@zudomart/chat-crypto";

import { groupPhotoSource, validateGroupPhotoFile } from "./groupPhoto.util";

const pointer = { key: "k".repeat(44), digest: "d".repeat(44), sizeBytes: 10, contentType: "image/jpeg" };
const attributes = (mediaId: string, contentType = "image/jpeg"): GroupAttributes => ({ title: "Lagos crew", description: null, avatar: { mediaId, pointer: { ...pointer, contentType } } });
const group = { kind: "group" as const, photoUrl: "https://media.example/signed", photoMediaId: "med_1" };

describe("encrypted group photos", () => {
  it("uses the photo only when the sealed avatar names the same media as the server", () => {
    assert.deepEqual(groupPhotoSource(group, attributes("med_1")), { url: group.photoUrl, pointer: attributes("med_1").avatar!.pointer, mediaId: "med_1" });
    assert.equal(groupPhotoSource(group, attributes("med_swapped")), null);
    assert.equal(groupPhotoSource({ ...group, photoUrl: null }, attributes("med_1")), null);
    assert.equal(groupPhotoSource(group, null), null);
    assert.equal(groupPhotoSource({ ...group, kind: "direct" }, attributes("med_1")), null);
    assert.equal(groupPhotoSource(group, attributes("med_1", "text/html")), null);
  });

  it("accepts only reasonably sized images", () => {
    assert.equal(validateGroupPhotoFile({ type: "image/png", size: 1024 }), null);
    assert.equal(validateGroupPhotoFile({ type: "application/pdf", size: 1024 }), "Choose a photo.");
    assert.equal(validateGroupPhotoFile({ type: "image/png", size: 11 * 1024 * 1024 }), "Group photos can be up to 10 MB.");
  });
});
