package dtos

type CreateCreatorProfileRequest struct {
	DisplayName *string `json:"displayName"`
	Handle      *string `json:"handle"`
	Bio         *string `json:"bio"`
}
