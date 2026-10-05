import { helpCategorySeeds } from "../../src/constants/helpCategories.constant.js";
import type { HelpAnswerDraftInput, HelpAnswerWriter } from "../../src/interfaces/helpAnswerWriter.interface.js";
import type { MediaDirectory, MediaRecord } from "../../src/interfaces/mediaDirectory.interface.js";
import type { IdentityDirectory } from "../../src/interfaces/identityDirectory.interface.js";
import { AutoFaqPublisher } from "../../src/modules/autoFaq/services/autoFaqPublisher.service.js";
import type { TicketModuleDependencies } from "../../src/modules/tickets/tickets.module.js";
import { InMemoryHelpContentStore } from "./inMemoryHelpContentStore.fake.js";
import { InMemoryTicketStore } from "./inMemoryTicketStore.fake.js";

export const requesterId = "11111111-1111-4111-8111-111111111111";
export const otherRequesterId = "22222222-2222-4222-8222-222222222222";
export const staff = { id: "adm_0003", name: "Ngozi Eze", role: "support", permissions: ["support:tickets", "support:chat"] };
export const lead = { id: "adm_0001", name: "Tolu Adeyemi", role: "support", permissions: ["support:tickets", "support:assign", "support:helpContent"] };

export class FakeMediaDirectory implements MediaDirectory {
  public readonly records = new Map<string, MediaRecord>();
  public lookups = 0;
  public add(record: MediaRecord) { this.records.set(record.id, record); }
  public async findMedia(mediaId: string) { this.lookups += 1; return this.records.get(mediaId) ?? null; }
}

export class RecordingWriter implements HelpAnswerWriter {
  public readonly inputs: HelpAnswerDraftInput[] = [];
  public constructor(private readonly respond: boolean) {}
  public async writeHelpAnswer(input: HelpAnswerDraftInput) {
    this.inputs.push(input);
    return this.respond ? { title: input.subject.endsWith("?") ? input.subject : `${input.subject}?`, summary: "Short summary.", question: input.subject, answerMarkdown: `## The question\n\n${input.question}\n\n## The answer\n\n${input.answer}`, tags: ["refund"], writer: "intelligence:template" } : null;
  }
}

export async function createSupportHarness(options: { readonly writerResponds?: boolean } = {}) {
  let now = new Date("2026-10-04T09:00:00.000Z");
  const clock = { now: () => new Date(now) };
  const ticketStore = new InMemoryTicketStore(() => clock.now());
  const helpStore = new InMemoryHelpContentStore();
  for (const [position, seed] of helpCategorySeeds.entries()) await helpStore.createCategory({ ...seed, position });
  const identity: IdentityDirectory = {
    findRequesterProfile: async (accountId) => ({ accountId, displayName: accountId === requesterId ? "Amaka Obi" : "Ken Otieno", username: accountId === requesterId ? "amaka_obi" : "ken.otieno", emailMasked: "a••••@gmail.com", status: "active" }),
    recordStaffAudit: async () => undefined,
  };
  const writer = new RecordingWriter(options.writerResponds ?? true);
  const media = new FakeMediaDirectory();
  const ticketDependencies: TicketModuleDependencies = { store: ticketStore, clock, identity, mediaPublicBaseUrls: ["https://media.zudomart.com"], media };
  return {
    clock, ticketStore, helpStore, identity, writer, ticketDependencies, media,
    publisher: new AutoFaqPublisher({ helpStore, writer }),
    advanceMinutes: (minutes: number) => void (now = new Date(now.getTime() + minutes * 60_000)),
  };
}
