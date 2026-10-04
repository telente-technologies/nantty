import { describe, expect, it } from "vitest";

import { autoFaqRequiresReviewSettingKey } from "../../src/constants/support.constant.js";
import { handleCreateSupportTicket } from "../../src/modules/tickets/commands/createSupportTicket/createSupportTicket.handler.js";
import { handlePostStaffReply } from "../../src/modules/tickets/commands/postStaffReply/postStaffReply.handler.js";
import { createHelpTopicEditor } from "../../src/modules/helpContent/services/helpTopicEditor.service.js";
import { rankTopicsBySimilarity } from "../../src/modules/autoFaq/services/topicSimilarity.service.js";
import { draftHelpAnswerFromTemplate } from "../../src/modules/autoFaq/services/templateHelpAnswerWriter.service.js";
import { createSupportHarness, requesterId, staff } from "../fakes/supportHarness.fake.js";

type Harness = Awaited<ReturnType<typeof createSupportHarness>>;

async function resolvedTicket(harness: Harness, subject: string, question: string, answer: string, category: "order" | "payment" | "safety" = "order") {
  const ticket = await handleCreateSupportTicket(harness.ticketDependencies, { accountId: requesterId, category, subject, message: question, attachmentUrls: [], linkedReference: null, channel: "form", idempotencyKey: null });
  return handlePostStaffReply(harness.ticketDependencies, { staff, ticketId: ticket.id, body: answer, isInternalNote: false, statusAfterReply: "resolved" });
}

async function seedTopic(harness: Harness, title: string, body: string, tags: string[] = []) {
  const category = await harness.helpStore.findCategoryBySlug("buying-and-orders");
  return harness.helpStore.createTopic({ categoryId: category!.id, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, ""), locale: "en", title, summary: "", bodyMarkdown: body, tags, status: "published", origin: "seed", sourceTicketId: null, seedKey: null, seedHash: null, editorName: "Zudomart", relatedTopicIds: [] });
}

describe("auto-FAQ from resolved tickets", () => {
  it("never sends personal data to the intelligence service and publishes a clean topic marked as from a resolved question", async () => {
    const harness = await createSupportHarness();
    const ticket = await resolvedTicket(harness, "How long do card refunds take?", "Hello, my name is Amaka Obi (amaka.obi@gmail.com, 0803 123 4567). I paid ₦25,000 for order ZM-48213 and the seller cancelled. How long do card refunds take?", "Hi Amaka, card refunds go back to the card you paid with. Banks usually take 3 to 7 working days. Thanks, Ngozi");
    const outcome = await harness.publisher.publishFromResolvedTicket(ticket);
    expect(outcome.action).toBe("created");
    const sent = JSON.stringify(harness.writer.inputs);
    expect(sent).not.toMatch(/Amaka|Obi|gmail|0803|25,000|48213|Ngozi/);
    const topic = await harness.helpStore.findTopicById(outcome.topicId!);
    expect(topic).toMatchObject({ origin: "resolved_question", status: "published", sourceTicketId: ticket.id });
    expect(JSON.stringify(topic)).not.toMatch(/Amaka|Obi|gmail|0803|25,000|48213|Ngozi/);
    expect(harness.helpStore.logs[0]).toMatchObject({ action: "created", ticketRef: `SUP-${ticket.number}` });
  });

  it("falls back to the deterministic template when the intelligence service is unavailable", async () => {
    const harness = await createSupportHarness({ writerResponds: false });
    const ticket = await resolvedTicket(harness, "Where do I find my store rewards balance?", "Where do I find my store rewards balance for a shop?", "Open the store page and tap Rewards. Your balance for that store is shown at the top and is applied at checkout.");
    const outcome = await harness.publisher.publishFromResolvedTicket(ticket);
    expect(outcome).toMatchObject({ action: "created", writer: "template" });
    const topic = await harness.helpStore.findTopicById(outcome.topicId!);
    expect(topic?.title).toBe("Where do I find my store rewards balance for a shop?");
    expect(topic?.bodyMarkdown).toContain("## The answer");
    expect(topic?.bodyMarkdown).toContain("## Still need help?");
  });

  it("appends a Related question section to a close existing topic instead of duplicating it", async () => {
    const harness = await createSupportHarness();
    const existing = await seedTopic(harness, "How do I confirm delivery of my order?", "## Confirming delivery\n\nOpen Orders and tap Confirm delivery.", ["delivery", "confirm"]);
    const ticket = await resolvedTicket(harness, "What happens if I don't confirm delivery of my order?", "What happens if I don't confirm delivery of my order after it arrives?", "If you do nothing, escrow releases the payment to the seller automatically 3 days after delivery.");
    const outcome = await harness.publisher.publishFromResolvedTicket(ticket);
    expect(outcome).toMatchObject({ action: "appended", topicId: existing.id });
    const updated = await harness.helpStore.findTopicById(existing.id);
    expect(updated?.bodyMarkdown).toContain("## Related question: What happens if I don't confirm delivery of my order?");
    expect(updated?.bodyMarkdown).toContain("*From a resolved question*");
    expect(updated?.relatedQuestions).toBe(1);
    expect(updated?.version).toBe(2);
    expect(harness.helpStore.topics.size).toBe(1);
  });

  it("skips a question the topic already answers", async () => {
    const harness = await createSupportHarness();
    await seedTopic(harness, "How do I confirm delivery?", "Open Orders and tap Confirm delivery.", ["delivery"]);
    const ticket = await resolvedTicket(harness, "How do I confirm delivery?", "How do I confirm delivery?", "Open Orders and tap Confirm delivery when the item arrives.");
    expect((await harness.publisher.publishFromResolvedTicket(ticket)).action).toBe("skipped");
  });

  it("creates a new topic linked to related ones when nothing is close enough", async () => {
    const harness = await createSupportHarness();
    const delivery = await seedTopic(harness, "How do I confirm delivery?", "Open Orders and tap Confirm delivery.", ["delivery"]);
    const ticket = await resolvedTicket(harness, "Can I change my delivery address after paying?", "Can I change my delivery address after paying for the order?", "You can ask the seller in chat before they ship. Once shipped, the address cannot be changed.");
    const outcome = await harness.publisher.publishFromResolvedTicket(ticket);
    expect(outcome.action).toBe("created");
    expect(await harness.helpStore.listRelatedTopicIds(outcome.topicId!)).toContain(delivery.id);
  });

  it("holds topics for review when the admin setting requires it", async () => {
    const harness = await createSupportHarness();
    await harness.helpStore.writeSetting(autoFaqRequiresReviewSettingKey, true);
    const ticket = await resolvedTicket(harness, "How do coins work?", "How do coins work when I buy them on the web?", "Coins you buy on the web are added to your wallet straight away and can be used for gifts.", "payment");
    const outcome = await harness.publisher.publishFromResolvedTicket(ticket);
    expect(outcome.action).toBe("pending_review");
    expect((await harness.helpStore.findTopicById(outcome.topicId!))?.status).toBe("pending_review");
  });

  it("never turns safety tickets or unanswered tickets into public topics", async () => {
    const harness = await createSupportHarness();
    const safety = await resolvedTicket(harness, "Someone is threatening me", "A buyer keeps sending threats in my messages.", "We have restricted the account and our trust team is reviewing it.", "safety");
    expect((await harness.publisher.publishFromResolvedTicket(safety)).action).toBe("skipped");
    expect(harness.writer.inputs).toHaveLength(0);
  });

  it("lets admins merge an auto topic into another one", async () => {
    const harness = await createSupportHarness();
    const target = await seedTopic(harness, "Refund timelines", "Card refunds take 3 to 7 working days.");
    const ticket = await resolvedTicket(harness, "When will my bank transfer refund arrive?", "When will my bank transfer refund arrive?", "Bank transfer refunds usually arrive within 1 to 3 working days after the refund is approved.", "payment");
    const outcome = await harness.publisher.publishFromResolvedTicket(ticket);
    const merged = await createHelpTopicEditor(harness.helpStore).merge(outcome.topicId!, target.id, "Tolu Adeyemi");
    expect(merged.bodyMarkdown).toContain("## Related question: When will my bank transfer refund arrive?");
    expect(merged.bodyMarkdown).not.toContain("Still need help");
    expect((await harness.helpStore.findTopicById(outcome.topicId!))).toMatchObject({ status: "merged", mergedIntoTopicId: target.id });
  });
});

describe("similarity ranking", () => {
  it("ranks a near-identical question above unrelated topics", async () => {
    const harness = await createSupportHarness();
    const close = await seedTopic(harness, "How do I withdraw my creator earnings?", "Open Studio, Earnings, Withdraw.");
    await seedTopic(harness, "How do I turn on dark mode?", "Settings, Appearance.");
    const draft = draftHelpAnswerFromTemplate({ category: "creator", locale: "en", subject: "How can I withdraw my earnings as a creator?", question: "How can I withdraw my earnings as a creator?", answer: "Open Studio and choose Withdraw." });
    const ranked = rankTopicsBySimilarity(draft, [...harness.helpStore.topics.values()]);
    expect(ranked[0]?.topic.id).toBe(close.id);
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });
});
