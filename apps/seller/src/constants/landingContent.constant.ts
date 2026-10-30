export const landingNavigationLinks = [
  { label: "Features", href: "#features" },
  { label: "Get access", href: "#access" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export const landingTickerItems = [
  "App orders with escrow",
  "Products and variants",
  "Stock across warehouses",
  "Sales analytics",
  "Discount codes and flash sales",
  "Customer segments",
  "Delivery tracking",
  "Messages and reviews",
  "Team roles",
  "CSV, Excel and PDF reports",
  "Payouts to your bank",
  "Creator affiliates",
  "Official Store badge",
] as const;

export interface LandingFeature {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly size: "wide" | "regular";
}

export const landingFeatures: LandingFeature[] = [
  { id: "overview", title: "Your whole business at a glance", description: "Sales today, orders by status, available balance, pending settlement, low stock, views and conversion — the moment you sign in.", size: "wide" },
  { id: "inventory", title: "One stock count, every warehouse", description: "App orders reserve stock automatically. Adjust with reasons, transfer between locations, set reorder levels and track suppliers.", size: "regular" },
  { id: "orders", title: "App orders with escrow built in", description: "Accept, pack and ship the orders customers place in the Nantty app, print invoices, and see exactly when escrow pays you.", size: "regular" },
  { id: "customers", title: "Customers you can grow", description: "Every buyer's history, total spent, average order and last purchase, with notes and segments for new, returning and VIP customers.", size: "regular" },
  { id: "reports", title: "Reports your accountant will like", description: "Sales, orders, inventory, customers, products, finance and ads. Download CSV, Excel or a printable PDF.", size: "wide" },
  { id: "staff", title: "A team that signs in with their own app account", description: "Add Nantty users by username as Manager, Inventory staff, Sales staff or Accountant. Each sees only what their role allows.", size: "regular" },
  { id: "wallet", title: "Payments and finance", description: "Money in escrow, pending settlement and available, fees, refunds, payouts and downloadable statements.", size: "regular" },
  { id: "affiliates", title: "Creators who sell for you", description: "Set commissions, approve creators from the Nantty Creator Program and invite them to live-sell your products. Commissions settle automatically from escrow.", size: "regular" },
  { id: "brand", title: "Your brand, protected", description: "Run your brand profile and team, link your stores, earn the Official Store badge when your brand is registered and Gold verified, and report listings that misuse your name.", size: "wide" },
];

export const landingQuestions = [
  { question: "Do I need a new account for the dashboard?", answer: "No. Sign in with the same email or username and password you use in the Nantty app. Your store, products, orders and wallet are already here." },
  { question: "Who can use Nantty Dashboard?", answer: "Every Nantty seller, free. You do not need Gold verification or a paid plan. Pro and Business only unlock extra tools such as bulk editing, advanced analytics, a team and API access." },
  { question: "What is the difference between the app and the dashboard?", answer: "The Nantty App lets you sell from anywhere — post products, chat and go live. The dashboard is where you run the business behind it: stock, orders, money, marketing, team and reports." },
  { question: "Are these the same orders as in the app?", answer: "Yes. Online orders are the marketplace orders customers place in the Nantty app. Anything you do here shows up in the app straight away." },
  { question: "How do I add my team?", answer: "From Team, search a person's Nantty username and pick a role. They accept in the app and sign in here with their own Nantty account — there are no separate staff logins." },
  { question: "When do I get paid?", answer: "Buyers pay into escrow. The money moves to your available balance after the buyer confirms delivery, and you can withdraw it to your bank." },
  { question: "How do I get the Official Store badge?", answer: "Register your brand in the Nantty app with your trademark or CAC documents, keep your business Gold verified, then apply from Brand › Official Store in the dashboard." },
  { question: "What happens if I cancel Pro or Business?", answer: "You move back to Free at the end of the period. Your products, orders and payouts keep working; only the paid tools lock until you upgrade again." },
];
