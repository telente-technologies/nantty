export const redactionKinds = [
  "link", "email", "card number", "phone", "reference", "order number", "amount", "ip address", "date", "address", "username", "name", "number",
] as const;
export type RedactionKind = (typeof redactionKinds)[number];

export const placeholderFor = (kind: RedactionKind): string => `[${kind}]`;

export const placeholderPattern = /\[(?:link|email|card number|phone|reference|order number|amount|ip address|date|address|username|name|number)\]/g;

const currencyWord = "(?:naira|ngn|kobo|cedis?|ghs|shillings?|kes|ksh|rand|zar|pounds?|gbp|euros?|eur|dollars?|usd|bucks)";
const currencySymbol = "(?:₦|\\$|£|€|GH₵|₵|KSh|Ksh|R(?=\\s?\\d)|N(?=\\s?\\d[\\d,.]*\\b))";
const numberWithSeparators = "\\d{1,3}(?:[,\\s]\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?";

export const personalDataPatterns: readonly { readonly kind: RedactionKind; readonly pattern: RegExp }[] = [
  { kind: "email", pattern: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu },
  { kind: "email", pattern: /\b[\w.+-]+\s*[([{]?\s*(?:at|@)\s*[)\]}]?\s*[\w-]+\s*[([{]?\s*(?:dot|\.)\s*[)\]}]?\s*(?:com|ng|net|org|co|io)\b/gi },
  { kind: "link", pattern: /\b(?:https?:\/\/|www\.)[^\s<>()"']+/gi },
  { kind: "link", pattern: /\b[a-z0-9-]+\.(?:com|ng|net|org|io|co|app|me|link|ly|xyz|shop|store)(?:\/[^\s<>()"']*)?/gi },
  { kind: "ip address", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { kind: "ip address", pattern: /\b(?:[0-9a-f]{1,4}:){4,7}[0-9a-f]{1,4}\b/gi },
  { kind: "reference", pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi },
  { kind: "amount", pattern: new RegExp(`(?<![\\p{L}\\p{N}])${currencySymbol}\\s?(?:${numberWithSeparators})(?:\\s?(?:k|K|m|M|million|thousand))?`, "gu") },
  { kind: "amount", pattern: new RegExp(`\\b(?:${currencyWord})\\s?(?:${numberWithSeparators})(?:\\s?(?:k|m|million|thousand))?\\b`, "gi") },
  { kind: "amount", pattern: new RegExp(`\\b(?:${numberWithSeparators})\\s?(?:k|m|million|thousand)?\\s?${currencyWord}\\b`, "gi") },
  { kind: "order number", pattern: /\b(?:ZM|ORD|SUP|TKT|DSP|INV|RF|TRX|TXN|REF)[-_#]?[A-Z0-9]*\d[A-Z0-9]*(?:[-_][A-Z0-9]+)*\b/g },
  { kind: "reference", pattern: /\b[a-z]{2,6}_[A-Za-z0-9]{4,}\b/g },
  { kind: "reference", pattern: /\b[A-Z]{2,6}-\d{3,}(?:-\d+)*\b/g },
  { kind: "order number", pattern: /(\b(?:order|invoice|ticket|tracking|waybill|transaction|reference|ref|receipt|dispute|refund)\s*(?:number|no\.?|num|id|code)?\s*(?:is|was|:|#)?\s*)#?[A-Z0-9]*\d[A-Z0-9-]{2,}\b/gi },
  { kind: "date", pattern: /\b(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)?\b/g },
  { kind: "card number", pattern: /\b(?:\d[ -]?){12,18}\d\b/g },
  { kind: "phone", pattern: /(?:\+|00)\d{1,3}[\s.-]?\(?\d{1,4}\)?(?:[\s.-]?\d{2,4}){2,4}\b/g },
  { kind: "phone", pattern: /\(?\b0\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g },
  { kind: "phone", pattern: /\b234\d{10}\b/g },
  { kind: "phone", pattern: /\(\d{3}\)\s?\d{3}[\s.-]\d{4}\b/g },
  { kind: "address", pattern: /\b(?:P\.?\s?O\.?\s?Box|PMB|Private Mail Bag)\s*\d+\b/gi },
  { kind: "address", pattern: /\b(?:no\.?\s*)?\d{1,5}[A-Za-z]?,?\s+(?:[A-Z][\w'.-]*\s+){0,4}(?:Street|St|Road|Rd|Avenue|Ave|Close|Crescent|Cres|Way|Lane|Ln|Drive|Dr|Boulevard|Blvd|Estate|Layout|Quarters|Court|Ct|Place|Pl|Terrace|Highway|Expressway|Junction|Market)\b(?:,\s*(?:[A-Z][\w'-]*|\d{1,4})(?:\s+(?:[A-Z][\w'-]*|\d{1,4})){0,3}){0,4}/g },
  { kind: "address", pattern: /\b(?:my|the|delivery|home|shipping|office)\s+address\s+(?:is|was|:)\s*[^.!?\n]+/gi },
  { kind: "address", pattern: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g },
  { kind: "username", pattern: /(^|[^\w@/])@[A-Za-z0-9_.]{2,30}\b/g },
  { kind: "number", pattern: /\b\d[\d -]{4,}\d\b/g },
];

export const honorificNamePattern = /\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Chief|Alhaji|Alhaja|Engr|Prof|Pastor|Barr|Madam|Sir|Aunty|Uncle|Oga|Mama|Baba)\.?\s+[A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)?/gu;
export const greetingNamePattern = /\b([Hh]i|[Hh]ello|[Hh]ey|[Hh]iya|[Dd]ear|[Gg]reetings|[Gg]ood\s+(?:morning|afternoon|evening|day))(\s*,?\s+)(?!(?:[Tt]here|[Tt]eam|[Aa]ll|[Ee]veryone|[Ss]upport|[Zz]udomart)\b)([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,2})/gu;
export const introductionNamePattern = /\b([Mm]y name is|[Mm]y name's|I am called|[Tt]his is|[Nn]ame\s*:)(\s+)([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,2})/gu;
export const signOffNamePattern = /\b([Tt]hanks|[Tt]hank you|[Rr]egards|[Kk]ind regards|[Ww]arm regards|[Bb]est regards|[Bb]est|[Cc]heers|[Ss]incerely|[Yy]ours faithfully|[Yy]ours sincerely)([,!.]?\s*\n?\s*[-–—]?\s*)([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,2})(?=\s*(?:,|\n|$|from\b|at\b))/gu;
export const namedPersonPattern = /\b(named|called|seller is|buyer is|customer is|agent is|courier is|rider is|driver is)(\s+)([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,2})/gu;
export const dashSignaturePattern = /(^|\n)\s*[-–—]{1,2}\s*[A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+){0,2}[^\n]*/gu;
export const capitalisedPairPattern = /(?<![.!?]\s|^|\n)\b([A-Z][\p{Ll}'-]+)\s+([A-Z][\p{Ll}'-]+)(?:\s+([A-Z][\p{Ll}'-]+))?/gu;

export const platformVocabulary: ReadonlySet<string> = new Set([
  "nantty", "studio", "ads", "manager", "help", "centre", "center", "creator", "program", "programme", "seller", "dashboard", "settings", "privacy",
  "data", "account", "profile", "blue", "gold", "black", "checkmark", "premium", "pro", "business", "free", "plan", "plans", "store", "rewards",
  "flutterwave", "apple", "google", "play", "app", "web", "mobile", "android", "ios", "iphone", "chat", "chats", "live", "lives", "clips", "clip",
  "stories", "story", "feed", "posts", "post", "mart", "orders", "order", "details", "cart", "checkout", "escrow", "wallet", "coins", "coin",
  "nanttypoints", "gifts", "gift", "battles", "battle", "goals", "obs", "streaming", "software", "payouts", "payout", "withdrawals", "withdrawal",
  "bank", "transfer", "card", "ussd", "notifications", "notification", "appearance", "dark", "mode", "light", "terms", "service", "policy",
  "cookie", "community", "guidelines", "contact", "support", "report", "reports", "requests", "request", "spam", "passcode", "streaks", "streak",
  "boost", "boosts", "campaign", "campaigns", "delivery", "shipping", "dispute", "disputes", "refund", "refunds", "subscriptions", "subscription",
  "fan", "fans", "earnings", "verification", "documents", "inventory", "products", "product", "promotions", "promotion", "analytics", "views",
  "bookmarks", "saved", "mentions", "comments", "threads", "reply", "replies", "controls", "sensitive", "content", "security", "password",
  "two", "factor", "authentication", "login", "sign", "export", "deletion", "delete", "suspension", "appeal", "appeals", "monday", "tuesday",
  "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december", "nigeria", "ghana", "kenya", "south", "africa", "united", "kingdom", "states", "europe",
  "lagos", "abuja", "accra", "nairobi", "naira", "the", "my", "your", "our", "i", "we", "you", "it", "this", "that", "please", "thanks", "dear",
  "hello", "hi", "okay", "ok", "yes", "no", "new", "old", "home", "menu", "tab", "button", "page", "screen", "inbox", "messages", "message",
  "official", "verified", "essential", "government", "personal", "brand", "brands", "general", "other", "safety", "trust", "legal", "faq",
  "quick", "fun", "legendary", "galaxy", "king", "empire", "multi", "guest", "guests", "host", "pending", "resolved", "closed", "open",
]);
