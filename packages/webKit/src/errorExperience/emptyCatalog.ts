import type { ErrorIconName } from "./errorKinds";

export const emptyKinds = ["generic", "feed", "search", "cart", "orders", "wallet", "notifications", "inbox", "products", "campaigns", "followers", "saved", "reviews", "lives", "clips"] as const;

export type EmptyKind = (typeof emptyKinds)[number];

export const emptyCatalog: Readonly<Record<EmptyKind, { readonly title: string; readonly description: string; readonly icon: ErrorIconName }>> = {
  generic: { title: "Nothing here yet", description: "When there's something to show, you'll find it here.", icon: "squaresFour" },
  feed: { title: "Your feed is quiet", description: "Follow people and stores you like, and their posts will show up here.", icon: "compass" },
  search: { title: "No results", description: "Check the spelling, or try a shorter or more general word.", icon: "magnifyingGlassMinus" },
  cart: { title: "Your cart is empty", description: "Find something you love in Mart and it'll wait for you here.", icon: "shoppingCart" },
  orders: { title: "No orders yet", description: "When you buy something, you can track it here from payment to delivery.", icon: "receipt" },
  wallet: { title: "No transactions yet", description: "Top-ups, payments, earnings and withdrawals will appear here.", icon: "wallet" },
  notifications: { title: "You're all caught up", description: "Likes, follows, orders and messages will show up here.", icon: "bell" },
  inbox: { title: "No messages yet", description: "Start a conversation with a friend or a store. Your chats are end-to-end encrypted.", icon: "chatsCircle" },
  products: { title: "No products yet", description: "Add your first product to start selling.", icon: "package" },
  campaigns: { title: "No campaigns yet", description: "Create a campaign to reach more people on Zudomart.", icon: "megaphone" },
  followers: { title: "No followers yet", description: "Share your profile and post regularly to grow your audience.", icon: "users" },
  saved: { title: "Nothing saved yet", description: "Tap save on posts and products to find them here later.", icon: "squaresFour" },
  reviews: { title: "No reviews yet", description: "Reviews from buyers will appear here.", icon: "sealCheck" },
  lives: { title: "No lives right now", description: "When people you follow go live, you'll see them here.", icon: "videoCameraSlash" },
  clips: { title: "No clips yet", description: "Short videos will show up here once they're posted.", icon: "playCircle" },
};
