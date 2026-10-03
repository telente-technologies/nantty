package dtos

import "encoding/json"

type UpdateSettingRequest struct {
	Value           json.RawMessage `json:"value"`
	ExpectedVersion int             `json:"expectedVersion"`
	Reason          string          `json:"reason"`
}
