import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { decideSensitiveInterstitialState, describeSensitiveLabels, readSensitiveConsentPostIds, rememberSensitiveConsentForPost } from "./sensitiveContent.util";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
}

describe("sensitive content interstitial", () => {
  it("covers labelled posts until the viewer consents and remembers the choice per post", () => {
    const storage = memoryStorage();
    const sensitive = { labels: ["graphic_violence"] as const, requiresInterstitial: true };
    assert.equal(decideSensitiveInterstitialState(sensitive, readSensitiveConsentPostIds(storage).includes("p1")), "covered");
    rememberSensitiveConsentForPost(storage, "p1");
    assert.equal(decideSensitiveInterstitialState(sensitive, readSensitiveConsentPostIds(storage).includes("p1")), "revealed");
    assert.equal(decideSensitiveInterstitialState(sensitive, readSensitiveConsentPostIds(storage).includes("p2")), "covered");
  });

  it("shows unlabelled posts and posts an adult chose to see without warnings", () => {
    assert.equal(decideSensitiveInterstitialState(undefined, false), "none");
    assert.equal(decideSensitiveInterstitialState({ labels: ["self_harm"], requiresInterstitial: false }, false), "none");
  });

  it("names what the post may contain", () => {
    assert.equal(describeSensitiveLabels(["nudity", "dangerous_acts"]), "This post may contain nudity or sexual content and dangerous acts.");
  });
});
