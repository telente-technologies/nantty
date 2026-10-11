import type { CatalogContext, CatalogEntry } from "./errorCatalog.types";
import type { ErrorKind, ErrorSubject } from "./errorKinds";
import { formatLimitMoney, readPositiveMoney } from "./limitMoney";

const goneCopy: Partial<Record<ErrorSubject, readonly [string, string]>> = {
  post: ["This post is gone", "It was deleted or is no longer available. There's plenty more on your feed."],
  clip: ["This clip is gone", "It was deleted or is no longer available. Keep watching more clips."],
  story: ["This story has ended", "Stories disappear after 24 hours, or the person removed it."],
  product: ["This product isn't available", "The seller removed it or it's no longer for sale. Similar items are waiting in Mart."],
  store: ["This store has closed", "The store isn't on Zudomart anymore. Discover other sellers in Mart."],
  profile: ["This account isn't available", "The account was deleted or deactivated."],
  live: ["This live has ended", "The broadcast is over. Follow the host to catch their next one."],
  comment: ["This comment was deleted", "The person who wrote it removed it."],
};

function describeWalletLimit(context: CatalogContext): string {
  const remaining = readPositiveMoney(context.details?.["remaining"]);
  const limit = formatLimitMoney(context.details?.["limit"]);
  if (remaining) return `You can pay ${remaining} more from your wallet today. Pay by card, or try again tomorrow.`;
  return limit ? `You've reached today's wallet limit of ${limit}. Pay by card, or try again tomorrow.` : "You've reached today's wallet limit. Pay by card, or try again tomorrow.";
}

function describeAmountRange(context: CatalogContext): string {
  const maximum = formatLimitMoney(context.details?.["maximum"]);
  const minimum = formatLimitMoney(context.details?.["minimum"]);
  if (context.details?.["reason"] === "contactSupportForLargeOrders") return `Orders above ${maximum ?? "this amount"} need a quick check first. Contact support to place a large order.`;
  if (maximum) return `The most you can pay in one go here is ${maximum}.`;
  if (minimum) return `The smallest payment here is ${minimum}.`;
  return "This amount can't be paid in one payment.";
}

export const contentAndCommerceCatalog: Partial<Record<ErrorKind, (context: CatalogContext) => CatalogEntry>> = {
  contentGone: (context) => {
    const [title, description] = goneCopy[context.subject ?? "post"] ?? ["This is no longer available", "It was deleted or moved."];
    return { title, description, icon: context.subject === "live" ? "videoCameraSlash" : "ghost", tone: "neutral", motion: "float", primary: "browse", secondary: "back" };
  },
  contentPrivate: () => ({ title: "This account is private", description: "Follow them to see their posts, clips and lives. They'll get a request to approve.", icon: "lockKey", tone: "neutral", motion: "float", primary: "back" }),
  contentBlocked: () => ({ title: "You can't see this", description: "One of you has blocked the other, so this isn't available. You can manage who you've blocked in Settings.", icon: "prohibit", tone: "neutral", motion: "breathe", primary: "back" }),
  contentRemoved: (context) => ({
    title: context.code === "COPYRIGHT" || context.details?.["reason"] === "copyright" ? "Removed after a copyright notice" : "Removed for breaking our rules",
    description: context.code === "COPYRIGHT" || context.details?.["reason"] === "copyright"
      ? "A rights holder reported this. If it's yours, you can send a counter-notice from Account status. Copyright strikes stay active for 12 months."
      : "This was taken down under our Community Guidelines. If it's yours, you can appeal from Account status and a person will review it.",
    icon: context.code === "COPYRIGHT" || context.details?.["reason"] === "copyright" ? "copyright" : "shieldWarning", tone: "caution", motion: "breathe", primary: "accountStatus", secondary: "back",
  }),
  sensitiveContent: (context) => ({
    title: "Sensitive content",
    description: context.details?.["ageRestricted"] === true ? "This is only for people aged 18 and over." : "This may be upsetting or graphic for some people.",
    icon: "eyeSlash", tone: "neutral", motion: "breathe", primary: context.details?.["canReveal"] === false ? "back" : "showAnyway", live: "status",
  }),
  mediaFailed: (context) => ({ title: context.subject === "video" ? "This video won't play" : "This image didn't load", description: "Your connection may have dropped, or the file is unavailable. Try again.", icon: context.subject === "video" ? "filmSlash" : "imageBroken", tone: "neutral", motion: "glitch", primary: "retry" }),
  decryptionFailed: (context) => {
    const reason = typeof context.details?.["reason"] === "string" ? (context.details["reason"] as string) : "";
    const description = reason === "NOT_FOR_THIS_DEVICE" ? "Sent before this device joined secure chat." : reason === "SENT_FROM_THIS_DEVICE" ? "You sent this message. Its text isn't stored on this device." : reason === "UNTRUSTED_IDENTITY" ? "This message couldn't be verified because the sender's security code changed." : "Waiting for this message. Ask the sender to send it again.";
    return { title: "Message unavailable on this device", description, icon: "lockKey", tone: "neutral", motion: "glitch", live: "status" };
  },
  liveUnavailable: (context) => {
    const reason = context.details?.["reason"];
    if (reason === "needsApp") return { title: "Update to watch this live", description: "This live uses features your version of Zudomart doesn't support yet. Update the app to join.", icon: "videoCameraSlash", tone: "brand", motion: "float", primary: "update" };
    if (reason === "ended") return { title: "This live has ended", description: "The broadcast is over. Follow the host to catch their next one.", icon: "videoCameraSlash", tone: "neutral", motion: "float", primary: "browse" };
    return { title: "This live isn't available", description: "It may have ended, or the host limited who can watch.", icon: "videoCameraSlash", tone: "neutral", motion: "float", primary: "browse", secondary: "retry" };
  },
  orderNotFound: () => ({ title: "We can't find that order", description: "It may belong to another account, or the link is wrong. Your own orders are all in one place.", icon: "receiptX", tone: "neutral", motion: "float", primary: "viewOrders" }),
  storeClosed: (context) => ({
    title: context.details?.["reason"] === "holiday" ? "This store is on a break" : "This store is closed for now",
    description: typeof context.details?.["reopensAt"] === "string" ? `The seller is away and reopens on ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(context.details["reopensAt"] as string))}. You can still browse.` : "The seller isn't taking orders right now. You can still browse and follow the store.",
    icon: "storefront", tone: "neutral", motion: "float", primary: "browse",
  }),
  outOfStock: () => ({ title: "Sold out", description: "This item just ran out. Follow the store to hear when it's back, or find something similar.", icon: "package", tone: "neutral", motion: "float", primary: "browse" }),
  regionUnavailable: () => ({ title: "Not available in your country", description: "This isn't offered where you are yet. We're working to bring more of Zudomart to you.", icon: "globe", tone: "neutral", motion: "float", primary: "browse" }),
  deliveryUnavailable: () => ({ title: "We can't deliver there yet", description: "This seller doesn't ship to your address. Try another address or look for sellers closer to you.", icon: "truck", tone: "neutral", motion: "float", primary: "changeAddress", secondary: "browse" }),
  checkoutExpired: () => ({ title: "Your checkout timed out", description: "For your safety, checkout sessions expire after a while. Nothing was charged. Start again from your cart.", icon: "clockCounterClockwise", tone: "caution", motion: "breathe", primary: "viewCart" }),
  cartChanged: (context) => ({
    title: "Your cart changed",
    description: context.details?.["reason"] === "soldOut" ? "An item in your cart just sold out. Review your cart before paying." : "Some prices changed since you added these items. Review your cart before paying.",
    icon: "shoppingCart", tone: "caution", motion: "breathe", primary: "viewCart",
  }),
  paymentFailed: (context) => ({
    title: context.code === "INSUFFICIENT_FUNDS" || context.code === "INSUFFICIENT_COINS" ? "Not enough balance" : "Payment didn't go through",
    description: context.code === "INSUFFICIENT_FUNDS" ? "Your balance is too low for this payment. Top up or pay another way." : context.code === "INSUFFICIENT_COINS" ? "You don't have enough coins for this. Buy more coins to continue." : "You weren't charged. Check your card or bank details, then try again or use another payment method.",
    icon: "creditCard", tone: "danger", motion: "breathe", primary: "retry", secondary: "support",
  }),
  paymentPending: () => ({ title: "Payment is still processing", description: "Your bank hasn't confirmed this yet. Don't pay again. We'll update your order as soon as it clears, usually within a few minutes.", icon: "hourglass", tone: "caution", motion: "breathe", primary: "viewOrders", live: "status" }),
  paymentLimit: (context) => ({
    title: context.code === "PAYMENT_AMOUNT_OUT_OF_RANGE" ? "This amount is outside the limit" : "Daily limit reached",
    description: context.code === "PAYMENT_AMOUNT_OUT_OF_RANGE" ? describeAmountRange(context) : context.code?.startsWith("WITHDRAWAL") ? "You've reached today's withdrawal limit. You can withdraw again tomorrow." : describeWalletLimit(context),
    icon: "wallet", tone: "caution", motion: "breathe", primary: context.code === "WALLET_DAILY_LIMIT" ? "payByCard" : "back", secondary: context.details?.["reason"] === "contactSupportForLargeOrders" ? "support" : undefined,
  }),
  sellerDebtLimit: (context) => context.details?.["audience"] === "buyer"
    ? { title: "This seller can't take orders right now", description: "Remove their items from your cart, or try again later.", icon: "storefront", tone: "caution", motion: "breathe", primary: "viewCart" }
    : { title: "Selling is paused", description: "You owe more than your selling limit allows. Clear what you owe to list items and take new orders again. Orders you already have aren't affected.", icon: "wallet", tone: "danger", motion: "breathe", primary: "clearDebt" },
  profileLimit: (context) => describeProfileLimit(context.code),
  countryRequired: () => ({ title: "Choose your country", description: "We need your country to show the right prices, payment methods and delivery options.", icon: "globe", tone: "brand", motion: "float", primary: "chooseCountry" }),
};

function describeProfileLimit(code: string | undefined): CatalogEntry {
  const shared = { icon: "storefront", tone: "neutral", motion: "float", primary: "manageProfiles", secondary: "back" } as const;
  if (code === "PROFILE_LIMIT_ONE_BRAND") return { ...shared, title: "You already have a Brand", description: "Each account can have one Brand, alongside one Store or one Business page. Manage your Brand from your profiles." };
  if (code === "PROFILE_ON_HOLD") return { ...shared, title: "Choose which profiles to keep", description: "Your account has more profiles than the rule allows. Choose which to keep, and you can post and list from them again." };
  if (code === "BRAND_SELLING_OFF") return { ...shared, title: "Selling is off for this brand", description: "Turn on Sell products with this brand in your brand settings before adding listings." };
  return { ...shared, title: "You can have one Store or one Business page", description: "Your account already has a Store or a Business page. You can keep one of them, plus one Brand." };
}
