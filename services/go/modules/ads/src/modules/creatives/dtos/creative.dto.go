package dtos

import (
	"zudomart/modules/ads/src/interfaces"
	"zudomart/modules/ads/src/types"
)

type ClientMetadata struct {
	Width           int `json:"width"`
	Height          int `json:"height"`
	DurationSeconds int `json:"durationSeconds"`
}

type CreateMediaUploadRequest struct {
	FileName       string          `json:"fileName"`
	MimeType       string          `json:"mimeType"`
	SizeBytes      int64           `json:"sizeBytes"`
	ClientMetadata *ClientMetadata `json:"clientMetadata"`
}

type MediaUploadIntent struct {
	MediaId       string            `json:"mediaId"`
	UploadUrl     string            `json:"uploadUrl"`
	UploadHeaders map[string]string `json:"uploadHeaders"`
	ExpiresAt     string            `json:"expiresAt"`
}

type CompletedUpload struct {
	MediaId string `json:"mediaId"`
	Status  string `json:"status"`
}

type UploadedMedia struct {
	MediaId string               `json:"mediaId"`
	Status  string               `json:"status"`
	Media   *types.CreativeMedia `json:"media"`
}

type MediaProcessedRequest struct {
	Status          string `json:"status"`
	Width           int    `json:"width"`
	Height          int    `json:"height"`
	DurationSeconds *int   `json:"durationSeconds"`
}

type PromotableDestination struct {
	interfaces.PromotedDestination
	Eligible         bool    `json:"eligible"`
	IneligibleReason *string `json:"ineligibleReason"`
}
