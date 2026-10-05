package dtos

type CreateStoreRequest struct {
	BusinessProfileId string  `json:"businessProfileId"`
	Name              string  `json:"name"`
	Slug              *string `json:"slug"`
	Description       string  `json:"description"`
	CountryCode       *string `json:"countryCode"`
}

type UpdateStoreRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	LogoUrl     *string `json:"logoUrl"`
	BannerUrl   *string `json:"bannerUrl"`
}

type StoreStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}
