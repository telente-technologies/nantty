// Local-only demo accounts the seed creates against the sandbox stack. Never valid anywhere else.
export interface DemoAccount {
  readonly role: "buyer" | "seller" | "creator";
  readonly email: string;
  readonly username: string;
  readonly name: string;
  readonly bio: string;
}

export const demoPassword = "Lagos-Market-Demo-2026!";

export const demoAccounts: readonly DemoAccount[] = [
  { role: "buyer", email: "demo.buyer@zudomart.test", username: "demobuyer", name: "Dayo Buyer", bio: "Demo buyer account" },
  { role: "seller", email: "demo.seller@zudomart.test", username: "demoseller", name: "Adaeze Seller", bio: "Owner of Ife Lifestyle (demo)" },
  { role: "creator", email: "demo.creator@zudomart.test", username: "democreator", name: "Tolu Creator", bio: "Lagos street style, every weekend" },
];

export const demoAdmin = { email: "admin.demo@zudomart.com", name: "Demo Admin", password: "Quartz-Harbour-Lantern-Velvet-2026!" };

export const demoProducts = [
  { name: "Ankara wrap dress", description: "Hand-finished ankara wrap dress, sizes 8 to 16.", sku: "DEMO-ANKARA-01", priceMinor: 2_500_000 },
  { name: "Leather slides", description: "Handmade leather slides from Aba.", sku: "DEMO-SLIDES-01", priceMinor: 1_200_000 },
  { name: "Beaded clutch", description: "Evening clutch with glass beads.", sku: "DEMO-CLUTCH-01", priceMinor: 850_000 },
];
