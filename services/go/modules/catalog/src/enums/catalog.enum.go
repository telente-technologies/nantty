package enums

const (
	ProductDraft    = "draft"
	ProductActive   = "active"
	ProductArchived = "archived"
)

const (
	VisibilityPublic    = "public"
	VisibilityStoreOnly = "store_only"
	VisibilityLinkOnly  = "link_only"
)

const (
	StoreActive    = "active"
	StoreSuspended = "suspended"
	StorePaused    = "paused"
	StoreClosed    = "closed"
)

const (
	ChannelStore = "store"
	ChannelBrand = "brand"
)

const (
	ReactionLike     = "like"
	ReactionBookmark = "bookmark"
)

const (
	ReviewKindProduct = "product"
	ReviewKindStore   = "store"
)

const (
	ReviewPublished = "published"
	ReviewReported  = "reported"
	ReviewHidden    = "hidden"
)

var ProductVisibilities = []string{VisibilityPublic, VisibilityStoreOnly, VisibilityLinkOnly}
var ProductStatuses = []string{ProductDraft, ProductActive, ProductArchived}
