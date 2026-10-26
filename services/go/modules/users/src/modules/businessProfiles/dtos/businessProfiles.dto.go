package dtos

import "nantty/modules/users/src/utils"

type CategorySelectionRequest struct {
	CategoryId    *string `json:"categoryId"`
	SubcategoryId *string `json:"subcategoryId"`
	CustomName    *string `json:"customName"`
}

type CreateBusinessProfileRequest struct {
	DisplayName  string                     `json:"displayName"`
	Handle       string                     `json:"handle"`
	Description  string                     `json:"description"`
	Website      *string                    `json:"website"`
	BusinessType string                     `json:"businessType"`
	Purpose      string                     `json:"purpose"`
	Categories   []CategorySelectionRequest `json:"categories"`
}

type UpdateBusinessProfileRequest struct {
	DisplayName *string              `json:"displayName"`
	Description *string              `json:"description"`
	Website     utils.NullableString `json:"website"`
	IsPrivate   *bool                `json:"isPrivate"`
}
