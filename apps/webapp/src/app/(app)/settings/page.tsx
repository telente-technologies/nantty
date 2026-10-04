import type { Metadata } from "next";
import Link from "next/link";

import { AppearanceSection } from "@/components/settings/appearanceSection";
import { NotificationPreferencesSection } from "@/components/settings/notificationPreferencesSection";
import styles from "@/components/settings/settingsHome.module.css";
import { BookmarkIcon, ChatIcon, ChevronRightIcon, LockIcon, MailIcon, MapPinIcon, OrdersIcon, UserIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Settings" };

const settingsLinks = [
  { href: "/settings/privacy", label: "Privacy & data", description: "Cookie choices, download your data, delete your account", icon: <LockIcon size={20} /> },
  { href: "/settings/addresses", label: "Addresses", description: "Delivery addresses used at checkout", icon: <MapPinIcon size={20} /> },
  { href: "/verify-email", label: "Email", description: "Verify the email used for receipts and payments", icon: <MailIcon size={20} /> },
  { href: "/me", label: "Profile", description: "Your public profile, posts and followers", icon: <UserIcon size={20} /> },
  { href: "/saved", label: "Saved items", description: "Posts, videos, clips and products you bookmarked", icon: <BookmarkIcon size={20} /> },
  { href: "/settings/account-status", label: "Account status", description: "Standing, copyright notices, strikes and appeals", icon: <LockIcon size={20} /> },
  { href: "/settings/reports", label: "Your reports", description: "Status of chats, messages and accounts you reported", icon: <LockIcon size={20} /> },
  { href: "/orders", label: "Orders", description: "Tracking, escrow and receipts", icon: <OrdersIcon size={20} /> },
  { href: "/help", label: "Help Centre", description: "Answers, contact support and your support requests", icon: <ChatIcon size={20} /> },
];

export default function SettingsPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Settings</h1>
      <AppearanceSection />
      <NotificationPreferencesSection />
      <nav className={styles.card} aria-label="More settings">
        <ul className={styles.linkList}>
          {settingsLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={styles.linkRow}>
                <span className={styles.linkIcon}>{link.icon}</span>
                <span className={styles.linkText}>
                  <span className={styles.linkLabel}>{link.label}</span>
                  <span className={styles.linkDescription}>{link.description}</span>
                </span>
                <ChevronRightIcon size={18} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
