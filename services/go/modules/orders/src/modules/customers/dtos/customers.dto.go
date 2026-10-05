package dtos

type CustomerProfileInput struct {
	Name           *string   `json:"name"`
	Phone          *string   `json:"phone"`
	Email          *string   `json:"email"`
	Tags           *[]string `json:"tags"`
	MarketingOptIn *bool     `json:"marketingOptIn"`
}
