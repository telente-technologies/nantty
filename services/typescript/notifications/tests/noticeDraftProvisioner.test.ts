import { describe, expect, it } from "vitest";

import { CreateDraftFromPublishedPolicyHandler } from "../src/modules/noticeDrafts/commands/createDraftFromPublishedPolicy/createDraftFromPublishedPolicy.handler.js";
import { NoticeDraftProvisionerService } from "../src/modules/noticeDrafts/services/noticeDraftProvisioner.service.js";
import type { LegalVersionFacts, LegalVersionSource } from "../src/interfaces/legalVersionSource.interface.js";
import { InMemoryNoticeDraftRepository } from "./fakes/inMemoryRepositories.fake.js";
import { makeEvent } from "./fakes/testHarness.fake.js";

const versionId = "0b6a3c9e-5a2d-4c3b-9f00-1d2e3f4a5b6c";

class FakeVersions implements LegalVersionSource {
  public readonly calls: { versionId: string; authorization: string }[] = [];
  public constructor(private readonly facts: LegalVersionFacts | null) {}
  public async findVersion(id: string, authorization: string) {
    this.calls.push({ versionId: id, authorization });
    return this.facts;
  }
}

const facts: LegalVersionFacts = { id: versionId, documentKey: "privacy", versionNumber: 4, changeSummary: "Retention changes.", effectiveAt: "2026-11-01T00:00:00.000Z", isMaterialChange: true };

describe("notice drafts for unpublished versions", () => {
  it("creates the draft once from the version, using the caller's staff token", async () => {
    const drafts = new InMemoryNoticeDraftRepository();
    const versions = new FakeVersions(facts);
    const provisioner = new NoticeDraftProvisionerService(drafts, versions, "https://zudomart.com");
    const draft = await provisioner.ensure(versionId, "Bearer staff-token");
    expect(draft).toMatchObject({ versionId, documentTitle: "Privacy Policy", versionNumber: 4, summaryText: "Retention changes.", requiresReacceptance: true, documentUrl: "https://zudomart.com/privacy" });
    expect(draft.reacceptNote).not.toBeNull();
    await provisioner.ensure(versionId, "Bearer staff-token");
    expect(versions.calls).toEqual([{ versionId, authorization: "Bearer staff-token" }]);
  });

  it("answers 404 for unknown versions and 401 without a staff token", async () => {
    const drafts = new InMemoryNoticeDraftRepository();
    await expect(new NoticeDraftProvisionerService(drafts, new FakeVersions(null), "https://zudomart.com").ensure(versionId, "Bearer t")).rejects.toMatchObject({ status: 404 });
    await expect(new NoticeDraftProvisionerService(drafts, new FakeVersions(facts), "https://zudomart.com").ensure(versionId, undefined)).rejects.toMatchObject({ status: 401 });
    await expect(new NoticeDraftProvisionerService(drafts, null, "https://zudomart.com").ensure(versionId, "Bearer t")).rejects.toMatchObject({ status: 404 });
  });

  it("keeps staff edits on publish but refreshes the effective date", async () => {
    const drafts = new InMemoryNoticeDraftRepository();
    await new NoticeDraftProvisionerService(drafts, new FakeVersions(facts), "https://zudomart.com").ensure(versionId, "Bearer t");
    await drafts.update(versionId, { subject: "Edited subject", summaryText: "Edited", whatChanged: ["One"], reacceptNote: "Accept please", updatedByName: "Tolu" });
    const queued: string[] = [];
    const handler = new CreateDraftFromPublishedPolicyHandler(drafts, "https://zudomart.com", true, { execute: async (command) => { queued.push(command.versionId); return {} as never; } });
    await handler.handlePolicyPublished({ event: makeEvent("policyVersion.published", { kind: "privacy", version: "4", versionId, documentKey: "privacy", effectiveAt: "2026-11-15T00:00:00.000Z", publishedBy: "Tolu", isMaterialChange: true }) });
    const draft = await drafts.find(versionId);
    expect(draft).toMatchObject({ subject: "Edited subject", reacceptNote: "Accept please", requiresReacceptance: true });
    expect(draft?.effectiveAt.toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(queued).toEqual([versionId]);
  });
});
