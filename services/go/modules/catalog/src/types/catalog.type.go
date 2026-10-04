package types

import (
	"time"

	"github.com/google/uuid"

	"zudomart/platform/money"
)

type StoreSummaryView struct {
	Id                  string  `json:"id"`
	Name                string  `json:"name"`
	LogoUrl             *string `json:"logoUrl"`
	Rating              float64 `json:"rating"`
	RatingCount         int     `json:"ratingCount"`
	ReviewCount         int     `json:"reviewCount"`
	EarnBackBasisPoints *int    `json:"earnBackBasisPoints"`
}

type StoreDetailView struct {
	StoreSummaryView
	OwnerUserId       string    `json:"ownerUserId"`
	BannerUrl         *string   `json:"bannerUrl"`
	Handle            string    `json:"handle"`
	Bio               string    `json:"bio"`
	Followers         int       `json:"followers"`
	ProductsCount     int       `json:"productsCount"`
	IsFollowing       bool      `json:"isFollowing"`
	Verified          bool      `json:"verified"`
	JoinedAt          time.Time `json:"joinedAt"`
	CountryCode       string    `json:"countryCode"`
	Currency          string    `json:"currency"`
	BusinessProfileId string    `json:"businessProfileId"`
	Posts             []any     `json:"posts"`
}

type ProductSummaryView struct {
	Id       string      `json:"id"`
	Name     string      `json:"name"`
	Price    money.Money `json:"price"`
	ImageUrl *string     `json:"imageUrl"`
	Liked    bool        `json:"liked"`
	Stock    int         `json:"stock"`
	StoreId  string      `json:"storeId"`

	PriceIsRegional bool         `json:"priceIsRegional"`
	ApproxPrice     *money.Money `json:"approxPrice"`
}

type BrandTagView struct {
	BrandId      string `json:"brandId"`
	Name         string `json:"name"`
	Relationship string `json:"relationship"`
}

type ProductDetailView struct {
	ProductSummaryView
	Images       []string             `json:"images"`
	Title        string               `json:"title"`
	Rating       float64              `json:"rating"`
	Promo        *string              `json:"promo"`
	Sizes        []string             `json:"sizes"`
	Colors       []string             `json:"colors"`
	ShippingInfo string               `json:"shippingInfo"`
	Description  string               `json:"description"`
	Store        StoreSummaryView     `json:"store"`
	Related      []ProductSummaryView `json:"related"`
	Brand        *BrandTagView        `json:"brand"`
	Variants     []BuyerVariantView   `json:"variants"`
}

type BuyerVariantView struct {
	Id      string      `json:"id"`
	Title   string      `json:"title"`
	Size    string      `json:"size"`
	Color   string      `json:"color"`
	Sku     string      `json:"sku"`
	Price   money.Money `json:"price"`
	InStock bool        `json:"inStock"`

	PriceIsRegional bool         `json:"priceIsRegional"`
	ApproxPrice     *money.Money `json:"approxPrice"`
}

type CategoryView struct {
	Id           string  `json:"id"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	ParentId     *string `json:"parentId"`
	Slug         string  `json:"slug"`
	Depth        int     `json:"depth"`
	StoreId      *string `json:"storeId"`
	ProductCount *int    `json:"productCount,omitempty"`
}

type BrandView struct {
	Id       string  `json:"id"`
	Name     string  `json:"name"`
	Slug     string  `json:"slug"`
	LogoUrl  *string `json:"logoUrl"`
	Official bool    `json:"official"`
}

type SellerStockView struct {
	LocationId string `json:"locationId"`
	OnHand     int    `json:"onHand"`
	Reserved   int    `json:"reserved"`
}

type SellerRegionalPriceView struct {
	Currency            string `json:"currency"`
	PriceMinor          int64  `json:"priceMinor"`
	CompareAtPriceMinor *int64 `json:"compareAtPriceMinor"`
}

type SellerVariantView struct {
	Id                string                    `json:"id"`
	ProductId         string                    `json:"productId"`
	Title             string                    `json:"title"`
	OptionValues      map[string]string         `json:"optionValues"`
	Sku               string                    `json:"sku"`
	Barcode           *string                   `json:"barcode"`
	Price             money.Money               `json:"price"`
	CompareAtPrice    *money.Money              `json:"compareAtPrice"`
	CostPrice         *money.Money              `json:"costPrice"`
	RegionalPrices    []SellerRegionalPriceView `json:"regionalPrices"`
	LowStockThreshold int                       `json:"lowStockThreshold"`
	ReorderPoint      int                       `json:"reorderPoint"`
	ReorderQuantity   int                       `json:"reorderQuantity"`
	Stock             []SellerStockView         `json:"stock"`
}

type SellerImageView struct {
	MediaId string `json:"mediaId"`
	Url     string `json:"url"`
}

type SellerProductView struct {
	Id              string              `json:"id"`
	Name            string              `json:"name"`
	Description     string              `json:"description"`
	CategoryId      *string             `json:"categoryId"`
	CategoryName    *string             `json:"categoryName"`
	Status          string              `json:"status"`
	PublishedOnline bool                `json:"publishedOnline"`
	Images          []SellerImageView   `json:"images"`
	Options         []OptionView        `json:"options"`
	Variants        []SellerVariantView `json:"variants"`
	Taxable         bool                `json:"taxable"`
	TrackInventory  bool                `json:"trackInventory"`
	Tags            []string            `json:"tags"`
	Brand           *BrandTagView       `json:"brand"`
	Visibility      string              `json:"visibility"`
	PublishAt       *time.Time          `json:"publishAt"`
	Attributes      []AttributeView     `json:"attributes"`
	Videos          []VideoView         `json:"videos"`
	SupplierId      *string             `json:"supplierId"`
	CreatedAt       time.Time           `json:"createdAt"`
	UpdatedAt       time.Time           `json:"updatedAt"`
}

type OptionView struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
}

type AttributeView struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type VideoView struct {
	Id    string `json:"id"`
	Url   string `json:"url"`
	Title string `json:"title"`
}

type ReviewAuthorView struct {
	Id        string  `json:"id"`
	Name      string  `json:"name"`
	Username  string  `json:"username"`
	AvatarUrl *string `json:"avatarUrl"`
}

type ReviewReplyView struct {
	Body       string     `json:"body"`
	AuthorName string     `json:"authorName"`
	CreatedAt  time.Time  `json:"createdAt"`
	UpdatedAt  *time.Time `json:"updatedAt"`
}

type PublicReviewView struct {
	Id                 string           `json:"id"`
	Author             ReviewAuthorView `json:"author"`
	Rating             int              `json:"rating"`
	Text               string           `json:"text"`
	Title              *string          `json:"title"`
	IsVerifiedPurchase bool             `json:"isVerifiedPurchase"`
	Reply              *ReviewReplyView `json:"reply"`
	CreatedAt          time.Time        `json:"createdAt"`
}

type SellerReviewProductView struct {
	Id       string  `json:"id"`
	Name     string  `json:"name"`
	ImageUrl *string `json:"imageUrl"`
}

type SellerReviewView struct {
	Id                 string                   `json:"id"`
	Kind               string                   `json:"kind"`
	Product            *SellerReviewProductView `json:"product"`
	Rating             int                      `json:"rating"`
	Title              *string                  `json:"title"`
	Body               string                   `json:"body"`
	Author             ReviewAuthorView         `json:"author"`
	OrderNumber        *string                  `json:"orderNumber"`
	IsVerifiedPurchase bool                     `json:"isVerifiedPurchase"`
	PhotoCount         int                      `json:"photoCount"`
	HelpfulCount       int                      `json:"helpfulCount"`
	Status             string                   `json:"status"`
	Reply              *ReviewReplyView         `json:"reply"`
	CreatedAt          time.Time                `json:"createdAt"`
}

type SellerAccessView struct {
	StoreId      *string  `json:"storeId"`
	StoreName    *string  `json:"storeName"`
	Verification any      `json:"verification"`
	Subscription any      `json:"subscription"`
	Entitlements any      `json:"entitlements"`
	Role         *string  `json:"role"`
	Permissions  []string `json:"permissions"`
}

type VariantIdentifier struct {
	ProductId uuid.UUID
	VariantId uuid.UUID
}
