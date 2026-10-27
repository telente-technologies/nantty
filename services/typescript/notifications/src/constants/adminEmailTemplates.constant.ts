export const adminEmailTemplates = [
  { id: "account-update", name: "Account update", kind: "TRANSACTIONAL", subject: "An update about your Nantty account", body: "Hi {{firstName}},\n\nWe are writing about your Nantty account.\n\nIf you have questions, reply to this email or contact support from the app." },
  { id: "support-follow-up", name: "Support follow-up", kind: "TRANSACTIONAL", subject: "Following up on your request", body: "Hi {{firstName}},\n\nWe wanted to follow up on your recent request and make sure everything is sorted.\n\nReply to this email if you still need help." },
  { id: "product-news", name: "Product news", kind: "MARKETING", subject: "What is new on Nantty", body: "Hi {{firstName}},\n\nHere is what is new on Nantty this month.\n\nUnsubscribe any time: {{unsubscribeUrl}}" },
] as const;
