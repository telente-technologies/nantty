import type { AppIconName } from "@/components/ui/appIcon";

export interface SettingsLink {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: AppIconName;
}

export function buildSettingsLinkGroups(isSeller: boolean): readonly { readonly title: string; readonly links: readonly SettingsLink[] }[] {
  return [
    {
      title: "Account",
      links: [
        { href: "/settings/account", label: "Account", description: "Username, email, phone and deactivation", icon: "userCircle24" },
        { href: "/settings/account-status", label: "Account status", description: "Standing, copyright notices, strikes and appeals", icon: "sealCheck20" },
        { href: "/settings/security", label: "Security & Password", description: "Password, blocked accounts and identity checks", icon: "shieldStar24" },
        { href: "/settings/privacy#privacy-controls", label: "Privacy", description: "Private account, mentions, downloads and sensitive content", icon: "eyeSlash24" },
        { href: "/settings/hidden-comments", label: "Hidden comments", description: "Comments you hid on your posts and clips", icon: "chatCircle24" },
        { href: "/settings/privacy#your-data", label: "Privacy & Data", description: "Cookie choices, download your data, delete your account", icon: "shieldCheck24" },
        { href: "#notification-settings", label: "Notification", description: "Choose what Zudomart tells you about", icon: "bell24" },
      ],
    },
    {
      title: "Preferences",
      links: [
        { href: "#app-preference", label: "App Preference", description: "Theme and display", icon: "slidersHorizontal24" },
        { href: "/settings/payment-methods", label: "Payment Methods", description: "Cards, subscriptions and seller payouts", icon: "creditCard24" },
        { href: "/settings/addresses", label: "Shipping Address", description: "Delivery addresses used at checkout", icon: "mapPin24" },
      ],
    },
    {
      title: "Selling",
      links: isSeller
        ? [{ href: "/seller", label: "Seller dashboard", description: "Products, orders and payouts for your store", icon: "speedometer24" }]
        : [{ href: "/seller/apply", label: "Start selling on Zudomart", description: "Free to apply", icon: "tag24" }],
    },
    {
      title: "Profiles",
      links: [{ href: "/settings/profiles", label: "Store, Business page and Brand", description: "One Store or one Business page, plus one Brand", icon: "buildingStore20" }],
    },
    {
      title: "Support",
      links: [
        { href: "/help", label: "Support", description: "Help Centre answers and your support requests", icon: "headset24" },
        { href: "/settings/reports", label: "Your reports", description: "Status of chats, messages and accounts you reported", icon: "flag24" },
        { href: "/settings/about", label: "About", description: "Terms, privacy policy and version", icon: "info24" },
      ],
    },
  ];
}
