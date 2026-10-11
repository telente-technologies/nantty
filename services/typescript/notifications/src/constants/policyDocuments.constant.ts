export const policyDocumentDefinitions: Readonly<Record<string, { readonly title: string; readonly publicPath: string }>> = {
  terms: { title: "Terms of Service", publicPath: "/terms" },
  privacy: { title: "Privacy Policy", publicPath: "/privacy" },
  cookies: { title: "Cookie Policy", publicPath: "/cookies" },
  "community-guidelines": { title: "Community Guidelines", publicPath: "/community-guidelines" },
  "seller-terms": { title: "Seller Terms", publicPath: "/seller-terms" },
  "creator-terms": { title: "Creator Program Terms", publicPath: "/creator-terms" },
  "ads-policy": { title: "Ads Policy", publicPath: "/ads-policy" },
  "refund-escrow-policy": { title: "Refund and Escrow Policy", publicPath: "/refund-escrow-policy" },
  "copyright-policy": { title: "Copyright and IP Policy", publicPath: "/copyright-policy" },
  "data-rights": { title: "Data Rights Requests", publicPath: "/data-rights" },
};
