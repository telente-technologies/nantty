import type { AutoTopicLogEntry, HelpCategory, HelpTopic, HelpTopicVersion } from "@/types/helpContent.type";

export interface MockHelpStore {
  categories: Omit<HelpCategory, "topicCount">[];
  topics: HelpTopic[];
  versions: Record<string, HelpTopicVersion[]>;
  related: Record<string, string[]>;
  autoLog: (Omit<AutoTopicLogEntry, "topic"> & { topicId: string | null })[];
  autoFaqRequiresReview: boolean;
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const categorySeeds = [
  ["hcat_buying", "buying-and-orders", "Buying and orders", "Cart, shipping, checkout, escrow, delivery, disputes and refunds."],
  ["hcat_payments", "payments-and-wallet", "Payments, coins and Premium", "Payment methods, saved cards, coins and Premium."],
  ["hcat_account", "account-and-login", "Account and login", "Signing up, signing in, passwords and usernames."],
  ["hcat_creators", "creators-and-earnings", "Creators and earnings", "The Creator Program, earnings and payouts."],
] as const;

function topic(id: string, categoryIndex: number, slug: string, title: string, summary: string, body: string, overrides: Partial<HelpTopic> = {}): HelpTopic {
  const category = categorySeeds[categoryIndex]!;
  return {
    id, slug, title, summary, categoryId: category[0], categorySlug: category[1], categoryTitle: category[2], tags: [], bodyMarkdown: body, status: "PUBLISHED", origin: "SEED",
    fromResolvedQuestion: false, sourceTicketId: null, mergedIntoTopicId: null, editedByStaff: false, version: 1, helpfulCount: 12, notHelpfulCount: 1, relatedQuestions: 0,
    updatedByName: "Zudomart", publishedAt: minutesAgo(9_000), createdAt: minutesAgo(9_000), updatedAt: minutesAgo(9_000), ...overrides,
  };
}

export function buildDemoHelpStore(): MockHelpStore {
  const topics = [
    topic("htop_escrow", 0, "how-escrow-protects-your-order", "How escrow protects your order", "Your payment is held until you confirm delivery.", "When you pay with escrow, the seller doesn't get your money straight away.\n\n1. You pay. The money is held in escrow.\n2. The seller ships your order.\n3. Tap **Confirm delivery** when it arrives.\n\nEscrow releases automatically 3 days after delivery."),
    topic("htop_refunds", 0, "disputes-and-refunds", "Disputes and refunds", "Open a dispute if an order is late, damaged, wrong or missing.", "## Open a dispute\n\nOpen the order and tap **Open a dispute** before escrow releases.\n\n## Refunds\n\n- Card refunds can take up to 10 business days."),
    topic("htop_coins", 1, "buy-coins", "Coins", "Buy coins to send gifts on lives.", "Coins are spent on gifts. A gift is final once sent."),
    topic("htop_username", 2, "usernames", "Usernames: rules and changes", "Usernames are created for you at sign-up.", "A username you stop using is held for 120 days."),
    topic("htop_auto_1", 0, "can-i-change-my-delivery-address-after-paying", "Can I change my delivery address after paying?", "You can ask the seller in chat before they ship.", "## The question\n\nCan I change my delivery address after paying for the order?\n\n## The answer\n\nYou can ask the seller in chat before they ship. Once shipped, the address cannot be changed.\n\n## Still need help?\n\nOpen Help centre and choose Contact support.", { origin: "RESOLVED_QUESTION", fromResolvedQuestion: true, sourceTicketId: "tkt_10430", updatedByName: "Zudomart Help", helpfulCount: 3, notHelpfulCount: 0, createdAt: minutesAgo(600), updatedAt: minutesAgo(600), publishedAt: minutesAgo(600) }),
    topic("htop_auto_2", 3, "how-do-i-convert-earned-coins", "How do I convert earned coins to cash?", "Open Creator Studio and choose Convert earned coins.", "## The question\n\nHow do I convert earned coins to cash?\n\n## The answer\n\n1. Open Creator Studio.\n2. Tap Convert earned coins.\n3. Choose an amount and confirm.", { status: "PENDING_REVIEW", origin: "RESOLVED_QUESTION", fromResolvedQuestion: true, sourceTicketId: "tkt_10431", updatedByName: "Zudomart Help", publishedAt: null, helpfulCount: 0, notHelpfulCount: 0, createdAt: minutesAgo(90), updatedAt: minutesAgo(90) }),
  ];
  return {
    categories: categorySeeds.map(([id, slug, title, description], position) => ({ id, slug, title, description, iconName: "question", position })),
    topics,
    versions: Object.fromEntries(topics.map((entry) => [entry.id, [{ version: 1, title: entry.title, summary: entry.summary, bodyMarkdown: entry.bodyMarkdown, tags: [], editedByName: entry.updatedByName, changeNote: "Created", createdAt: entry.createdAt }]])),
    related: { htop_escrow: ["htop_refunds"] },
    autoLog: [
      { id: "alog_1", ticketId: "tkt_10430", ticketRef: "SUP-10430", action: "CREATED", similarity: 0.31, writer: "intelligence:template", note: "Published automatically.", createdAt: minutesAgo(600), topicId: "htop_auto_1" },
      { id: "alog_2", ticketId: "tkt_10431", ticketRef: "SUP-10431", action: "PENDING_REVIEW", similarity: 0.12, writer: "template", note: "Possible personal data left (digits); held for review.", createdAt: minutesAgo(90), topicId: "htop_auto_2" },
      { id: "alog_3", ticketId: "tkt_10432", ticketRef: "SUP-10432", action: "APPENDED", similarity: 0.64, writer: "intelligence:template", note: "Added as a related question to \"Disputes and refunds\".", createdAt: minutesAgo(45), topicId: "htop_refunds" },
      { id: "alog_4", ticketId: "tkt_10433", ticketRef: "SUP-10433", action: "SKIPPED", similarity: 0, writer: "none", note: "Safety tickets never become public topics.", createdAt: minutesAgo(20), topicId: null },
    ],
    autoFaqRequiresReview: false,
  };
}
