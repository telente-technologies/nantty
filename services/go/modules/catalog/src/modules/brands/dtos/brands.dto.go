package dtos

type CreateBrandRequest struct {
	Name        string  `json:"name"`
	Handle      string  `json:"handle"`
	LogoUrl     *string `json:"logoUrl"`
	CoverUrl    *string `json:"coverUrl"`
	CategoryId  string  `json:"categoryId"`
	Description string  `json:"description"`
	Website     *string `json:"website"`
}

type OfficialDecisionRequest struct {
	Reason string `json:"reason"`
}

type UpdateBrandRequest struct {
	SellingEnabled *bool `json:"sellingEnabled"`
}

type CreateStorefrontRequest struct {
	CountryCode *string `json:"countryCode"`
}

type ReassignBrandRequest struct {
	ToAccountId string `json:"toAccountId"`
	Reason      string `json:"reason"`
}
