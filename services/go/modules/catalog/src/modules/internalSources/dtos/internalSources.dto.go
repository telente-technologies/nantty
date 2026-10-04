package dtos

type StoreSearchSource struct {
	StoreId        string         `json:"storeId"`
	OwnerAccountId string         `json:"ownerAccountId"`
	Name           string         `json:"name"`
	Handle         string         `json:"handle"`
	Description    string         `json:"description"`
	LogoUrl        *string        `json:"logoUrl"`
	Rating         float64        `json:"rating"`
	RatingCount    int            `json:"ratingCount"`
	ReviewCount    int            `json:"reviewCount"`
	Verified       bool           `json:"verified"`
	Verification   map[string]any `json:"verification"`
	Active         bool           `json:"active"`
	CountryCode    *string        `json:"countryCode"`
	CategoryNames  []string       `json:"categoryNames"`
	CreatedAt      string         `json:"createdAt"`
}

type ProductSearchSource struct {
	ProductId        string   `json:"productId"`
	StoreId          string   `json:"storeId"`
	OwnerAccountId   string   `json:"ownerAccountId"`
	Name             string   `json:"name"`
	Description      string   `json:"description"`
	BrandName        *string  `json:"brandName"`
	CategoryPath     []string `json:"categoryPath"`
	Tags             []string `json:"tags"`
	PriceAmountMinor int64    `json:"priceAmountMinor"`
	Currency         string   `json:"currency"`
	ImageUrl         *string  `json:"imageUrl"`
	Stock            int      `json:"stock"`
	Status           string   `json:"status"`
	Visibility       string   `json:"visibility"`
	StoreActive      bool     `json:"storeActive"`
	CountryCode      *string  `json:"countryCode"`
	ShippingRegions  []string `json:"shippingRegions"`
	PurchaseCount    int      `json:"purchaseCount"`
	SaveCount        int      `json:"saveCount"`
	CreatedAt        string   `json:"createdAt"`
}

type CategorySearchSource struct {
	CategoryId string   `json:"categoryId"`
	Name       string   `json:"name"`
	Synonyms   []string `json:"synonyms"`
	Path       []string `json:"path"`
	Active     bool     `json:"active"`
	CreatedAt  string   `json:"createdAt"`
}

type BrandSearchSource struct {
	BrandId         string         `json:"brandId"`
	OwnerAccountId  *string        `json:"ownerAccountId"`
	Name            string         `json:"name"`
	Handle          string         `json:"handle"`
	Description     string         `json:"description"`
	LogoUrl         *string        `json:"logoUrl"`
	Verified        bool           `json:"verified"`
	Verification    map[string]any `json:"verification"`
	FollowerCount   int            `json:"followerCount"`
	OfficialStoreId *string        `json:"officialStoreId"`
	Active          bool           `json:"active"`
	CreatedAt       string         `json:"createdAt"`
}

type ModerationTargetPreview struct {
	OwnerId    string   `json:"ownerId"`
	Title      *string  `json:"title"`
	Text       *string  `json:"text"`
	MediaUrls  []string `json:"mediaUrls"`
	SoundTitle *string  `json:"soundTitle"`
	CreatedAt  string   `json:"createdAt"`
}

type AudienceMember struct {
	AccountId    string `json:"accountId"`
	LastActiveAt string `json:"lastActiveAt"`
	Interactions int    `json:"interactions"`
}
