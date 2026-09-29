export const landingNavigationLinks = [
  { label: "Features", href: "#features" },
  { label: "Get access", href: "#access" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export const landingTickerItems = [
  "Point of sale",
  "Barcode scanning",
  "Works offline",
  "Split payments",
  "Cash drawer and shifts",
  "Stock across locations",
  "Escrow orders",
  "Loyalty points",
  "Cashier PINs",
  "Tax reports",
  "Payouts to your bank",
  "Creator affiliates",
  "Official Store badge",
] as const;

export interface LandingFeature {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly screenshot: string;
  readonly screenshotAlt: string;
  readonly size: "wide" | "regular";
}

export const landingFeatures: LandingFeature[] = [
  { id: "pos", title: "A register that keeps selling offline", description: "Scan barcodes with a USB scanner or your camera, split cash, card and transfer, print 58 or 80 mm receipts, park sales, and keep ringing up when the network drops. Sales sync the moment you are back.", screenshot: "posRegister", screenshotAlt: "The register with a product grid and a receipt-style cart", size: "wide" },
  { id: "inventory", title: "One stock count, every location", description: "Online orders and counter sales draw from the same numbers. Adjust with reasons, transfer between shops and warehouse, and get low-stock alerts.", screenshot: "inventoryLevels", screenshotAlt: "Inventory levels per location with reserved and available stock", size: "regular" },
  { id: "orders", title: "Online orders with escrow built in", description: "Pack and ship marketplace orders, add tracking, and see exactly when escrow pays you after the buyer confirms delivery.", screenshot: "orderEscrow", screenshotAlt: "An online order with escrow status and the mark-as-shipped form", size: "regular" },
  { id: "customers", title: "Customers and loyalty", description: "Every buyer's history across the app and your counter, with notes, tags and points they can spend at the till.", screenshot: "customerProfile", screenshotAlt: "A customer profile with purchase history and loyalty points", size: "regular" },
  { id: "reports", title: "Reports your accountant will like", description: "Sales by day, product, staff, payment method and location, tax collected, stock valuation and shift variances. Export any of them to CSV.", screenshot: "salesReport", screenshotAlt: "A sales-by-day report with a chart and table", size: "wide" },
  { id: "staff", title: "Staff, roles and cashier PINs", description: "Owners, managers, cashiers, inventory and support each see only what they need. Cashiers switch in on a shared tablet with a PIN.", screenshot: "staffRoles", screenshotAlt: "The staff list with roles, locations and PIN status", size: "regular" },
  { id: "wallet", title: "Wallet and payouts", description: "Money in escrow, pending and available, every transaction, and withdrawals to your bank account.", screenshot: "walletPayouts", screenshotAlt: "Wallet balances and recent transactions", size: "regular" },
  { id: "affiliates", title: "Creators who sell for you", description: "Set commissions, approve creators from the Zudomart Creator Program and invite them to live-sell your products. Commissions settle automatically from escrow.", screenshot: "affiliateCreators", screenshotAlt: "The affiliates overview with top creators and commissions", size: "regular" },
  { id: "brand", title: "Your brand, protected", description: "Run your brand profile and team, link your stores, earn the Official Store badge when your brand is registered and Gold verified, and report listings that misuse your name.", screenshot: "brandProtection", screenshotAlt: "Brand protection listings ranked by risk with a file-claim button", size: "wide" },
];

export const landingQuestions = [
  { question: "Do I need a new account for the dashboard?", answer: "No. Sign in with the same email, username or phone number and password you use in the Zudomart app. Your store, products, orders and wallet are already here." },
  { question: "Who can use Zudomart Dashboard?", answer: "Verified businesses on the Gold Pro or Gold Premium plan, and the staff they invite. Gold is the same subscription that puts the gold badge on your store in the app." },
  { question: "How do I get access?", answer: "Verify your business in the Zudomart app (Profile → Start selling), choose Gold Pro or Gold Premium, then sign in here with the same account." },
  { question: "Is stock shared between the app and my shop?", answer: "Yes. There is one stock count per location. An online order reserves stock and a counter sale reduces it, so you never sell the same item twice." },
  { question: "What happens if the internet goes off at the counter?", answer: "The register keeps working. Sales are saved on the device and sent to Zudomart in order when you reconnect, without duplicates." },
  { question: "When do I get paid for online orders?", answer: "Buyers pay into escrow. The money moves to your available balance after the buyer confirms delivery, and you can withdraw it to your bank." },
  { question: "How do I get the Official Store badge?", answer: "Register your brand in the Zudomart app with your trademark or CAC documents, keep your business Gold verified with an active plan, then apply from Brand → Official Store in the dashboard." },
  { question: "Which hardware works?", answer: "Any laptop or tablet with a modern browser. USB and Bluetooth barcode scanners, receipt printers set up in your browser, and the card terminal you already use for card payments." },
];
