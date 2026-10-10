package usernames

type MatchKind string

const (
	MatchExact    MatchKind = "exact"
	MatchPrefix   MatchKind = "prefix"
	MatchContains MatchKind = "contains"
	MatchBrand    MatchKind = "brand"
)

type ReservedRule struct {
	Term string
	Kind MatchKind
}

var exactTerms = []string{
	"root", "help", "payments", "payment", "wallet", "escrow", "billing", "staff", "mod", "mods", "team", "api", "www", "mail", "email",
	"ads", "dashboard", "system", "null", "undefined", "anonymous", "me", "settings", "login", "signup", "account", "accounts", "about",
	"terms", "privacy", "legal", "careers", "jobs", "press", "news", "status", "blog", "shop", "store", "market", "mart", "seller",
	"sellers", "buyer", "notifications", "messages", "explore", "search", "home", "contact", "info", "abuse", "postmaster", "hostmaster",
	"webmaster", "noreply", "owner", "founder", "ceo", "all",
}

var webRouteTerms = []string{
	"analytics", "bff", "brand", "brands", "cart", "category", "categories", "chat", "chats", "checkout", "clip", "clips", "coins",
	"collection", "collections", "creator", "creators", "feed", "forgot-password", "live", "lives", "me", "notifications", "order",
	"orders", "pay", "post", "posts", "product", "products", "profile", "reset-password", "saved", "settings", "store-rewards", "stores",
	"subscriptions", "user", "users", "verify-email", "watch", "welcome", "security-check", "cookies", "guidelines", "community-guidelines",
	"creator-terms", "faq", "sitemap", "sitemaps", "robots", "favicon", "manifest", "_next", "static", "assets", "images", "icons", "fonts", "public",
	"embed", "oembed", "share", "invite", "download", "app", "apps", "reels", "videos", "video", "rankings", "wallet", "studio",
	"rss", "logout", "register", "auth", "oauth", "callback", "new", "create", "edit", "trending", "discover", "tags", "hashtag",
}

var prefixTerms = []string{
	"admin", "superadmin", "verify", "verified", "official", "support", "security", "moderator", "customercare", "helpdesk",
	"government", "govt", "ministry", "federal", "presidency", "president", "governor", "senate", "senator", "police", "army", "navy",
	"airforce", "customs", "immigration", "efcc", "inec", "nnpc", "nafdac", "statehouse", "centralbank",
}

var containsTerms = []string{"zudomart", "zudopay"}

var wellKnownBrands = []string{
	"google", "apple", "facebook", "instagram", "meta", "whatsapp", "tiktok", "twitter", "youtube", "snapchat", "linkedin", "telegram",
	"amazon", "microsoft", "netflix", "spotify", "paypal", "visa", "mastercard", "samsung", "jumia", "konga", "paystack", "flutterwave",
	"opay", "palmpay", "moniepoint", "kuda", "mtn", "airtel", "glo", "dangote", "access", "gtbank", "zenithbank", "firstbank", "uba",
	"stanbic", "nike", "adidas", "cocacola", "pepsi", "shoprite", "bolt", "uber", "chowdeck", "glovo",
}

var brandImpersonationAffixes = []string{
	"official", "ng", "nigeria", "africa", "hq", "support", "help", "care", "team", "app", "global", "real", "the", "verified", "inc", "ltd", "store", "shop",
}

func SystemReservedRules() []ReservedRule {
	rules := make([]ReservedRule, 0, len(exactTerms)+len(webRouteTerms)+len(prefixTerms)+len(containsTerms)+len(wellKnownBrands))
	for _, term := range exactTerms {
		rules = append(rules, ReservedRule{Term: term, Kind: MatchExact})
	}
	for _, term := range webRouteTerms {
		rules = append(rules, ReservedRule{Term: term, Kind: MatchExact})
	}
	for _, term := range prefixTerms {
		rules = append(rules, ReservedRule{Term: term, Kind: MatchPrefix})
	}
	for _, term := range containsTerms {
		rules = append(rules, ReservedRule{Term: term, Kind: MatchContains})
	}
	for _, term := range wellKnownBrands {
		rules = append(rules, ReservedRule{Term: term, Kind: MatchBrand})
	}
	return rules
}
