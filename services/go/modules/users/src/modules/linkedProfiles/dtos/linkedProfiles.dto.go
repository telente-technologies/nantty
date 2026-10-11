package dtos

type ClaimRequest struct {
	Kind      string  `json:"kind"`
	ProfileId string  `json:"profileId"`
	StoreId   *string `json:"storeId"`
}

type TransferBrandRequest struct {
	BrandId       string `json:"brandId"`
	FromAccountId string `json:"fromAccountId"`
}

type ChooseRequest struct {
	Keep   []string `json:"keep"`
	Reason string   `json:"reason"`
}

type ConvertRequest struct {
	ProfileId string `json:"profileId"`
	ToKind    string `json:"toKind"`
	Reason    string `json:"reason"`
}
