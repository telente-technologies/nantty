import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyMockUpheldRemedy, readMockCopyrightPolicy } from "@/mocks/handlers/trust/copyrightRemedies.mock";
import { buildDemoCopyrightClaims } from "@/mocks/seed/trustCopyright.mock";

describe("copyright remedies in the admin console mocks", () => {
  it("mutes audio claims, warns on video claims and takes live down", () => {
    const [audioClaim, imageClaim] = buildDemoCopyrightClaims();
    assert.ok(audioClaim && imageClaim);
    assert.deepEqual(applyMockUpheldRemedy(audioClaim), { remedy: "AUDIO_MUTED", issuesStrike: false });
    assert.equal(audioClaim.targetFlag, "MUTED");
    assert.deepEqual(applyMockUpheldRemedy(imageClaim), { remedy: "TAKEDOWN_WARNING", issuesStrike: false });
    const hours = (Date.parse(imageClaim.takedownDeadlineAt ?? "") - Date.now()) / 3_600_000;
    assert.ok(Math.abs(hours - readMockCopyrightPolicy().takedownDeadlineHours) < 0.1);
    const live = { ...imageClaim, target: { ...imageClaim.target, type: "LIVE" as const } };
    assert.deepEqual(applyMockUpheldRemedy(live), { remedy: "TAKEN_DOWN", issuesStrike: true });
  });
});
