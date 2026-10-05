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
