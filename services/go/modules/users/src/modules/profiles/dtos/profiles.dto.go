package dtos

import "zudomart/modules/users/src/utils"

type UpdateProfileRequest struct {
	Name          *string              `json:"name"`
	Bio           *string              `json:"bio"`
	Website       utils.NullableString `json:"website"`
	AvatarUrl     utils.NullableString `json:"avatarUrl"`
	BannerUrl     utils.NullableString `json:"bannerUrl"`
	AvatarMediaId *string              `json:"avatarMediaId"`
	BannerMediaId *string              `json:"bannerMediaId"`
	IsPrivate     *bool                `json:"isPrivate"`
}

type UploadIntentRequest struct {
	Purpose     string `json:"purpose"`
	ContentType string `json:"contentType"`
	SizeBytes   int64  `json:"sizeBytes"`
}

type PreferencesRequest struct {
	CountryCode *string `json:"countryCode"`
	Theme       *string `json:"theme"`
}
