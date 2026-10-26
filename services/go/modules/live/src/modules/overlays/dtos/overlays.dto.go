package dtos

import "nantty/modules/live/src/types"

type OverlaySceneRequest struct {
	Name    *string               `json:"name"`
	Layers  *[]types.OverlayLayer `json:"layers"`
	Publish *bool                 `json:"publish"`
}
