import { ApiError } from "@/errors/api.error";
import type { HelpArticle } from "@/types/trust.type";

import { createMockRoute, type MockRoute } from "./registry.mock";

const articles: readonly HelpArticle[] = [
  { id: "ha_escrow", topic: "Orders & payments", title: "How escrow protects your order", summary: "Your payment stays in the seller's escrow until you confirm delivery.", body: "When you pay, the money is held in escrow inside the seller's account. The seller only gets it after you confirm receipt, or automatically 3 days after delivery if you don't raise a problem.\n\nIf something is wrong, open a dispute from the order page before the 3 days pass." },
  { id: "ha_dispute", topic: "Orders & payments", title: "Opening a dispute", summary: "What to do when an item arrives damaged, wrong or not at all.", body: "Go to Orders, open the order and tap Open a dispute. Add photos and a short description. The seller has 48 hours to respond and our team steps in if you can't agree." },
  { id: "ha_refund", topic: "Orders & payments", title: "When will I get my refund?", summary: "Refund timelines for cards, transfers and wallet balances.", body: "Approved refunds go back to the account you paid from. Cards usually take 3 to 7 working days, bank transfers 1 to 3 working days." },
  { id: "ha_username", topic: "Account", title: "Choosing and changing your username", summary: "Rules for usernames, reserved names and how often you can change.", body: "Usernames are 3 to 20 characters. Some names are reserved for Zudomart or withheld under our policies. You can change your username once every 30 days, up to 3 times a year." },
  { id: "ha_suspended", topic: "Account", title: "My account was suspended", summary: "Why accounts get suspended and how to appeal.", body: "Accounts are suspended when they break our Community Guidelines. You can appeal from the suspension screen. If the suspension isn't lifted, your profile and content are deleted after 120 days." },
  { id: "ha_checkmark", topic: "Verification", title: "Blue, Gold and Black checkmarks", summary: "Who qualifies for each checkmark and how to apply.", body: "Blue is for people: verify your ID, have an account at least 90 days old, 1,000 real followers and no recent violations. Gold is for verified businesses with an active store and a good success rate, and comes with the Pro and Business plans after verification. Black is for government bodies and can't be applied for." },
  { id: "ha_creator", topic: "Creators", title: "Joining the Creator Program", summary: "Eligibility, instant approval and manual review.", body: "Open Switch to creator account in Settings to see your progress. Your personal account becomes a creator account when approved. If you meet every requirement you may be approved instantly or sent for a quick manual review." },
  { id: "ha_documents", topic: "Selling", title: "Business documents", summary: "Upload your CAC certificate, ID and address proof.", body: "You can open a store without documents. Uploading them lets our team verify your business so you can earn the Gold checkmark. Approved, pending and rejected documents are shown on the Business documents page." },
  {
    id: "ha_views",
    topic: "Posts & feed",
    title: "About views",
    summary: "How views are counted, what counts as a view and what stays private.",
    body: "A view is counted each time a post or clip appears on someone's screen in Zudomart: in a feed, on a profile, in search results, in a list of quotes, or when the post is opened from a link.\n\nWhat counts as a view\nEvery appearance counts, including repeat views by the same person and views by people who aren't signed in. Views from a promotion count too. Watching only part of a video still counts as a view.\n\nWhat doesn't count\nThe author's own views never count. We also leave out traffic we detect as automated, and views of posts while they are hidden by moderation.\n\nWho sees what\nEveryone sees the total number of views on a post. Only the author can open post analytics, which show impressions by day, unique viewers, profile visits and engagement.\n\nPrivacy\nViews are counted anonymously. Authors never see who viewed their post, only totals. We don't sell view data. If you don't want your activity used to personalise your feed, turn off personalisation under Settings, Privacy & Data.",
  },
  { id: "ha_marketing", topic: "Privacy", title: "Marketing emails", summary: "Control what we email you and how often.", body: "Personalised picks come only from verified sellers and only if you opt in. Choose weekly, only important or off under Settings, Privacy & Data." },
];

const matches = (article: HelpArticle, term: string) => `${article.title} ${article.summary} ${article.topic} ${article.body}`.toLowerCase().includes(term);

export const helpCenterMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/help/articles", ({ query }) => {
    const term = (query.get("q") ?? "").trim().toLowerCase();
    return term ? articles.filter((article) => matches(article, term)) : articles;
  }),
  createMockRoute("GET", "/api/v1/help/articles/:articleId", ({ params }) => {
    const article = articles.find((candidate) => candidate.id === params.articleId);
    if (!article) throw new ApiError(404, "Article not found");
    return article;
  }),
];
