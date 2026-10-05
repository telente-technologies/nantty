package dtos

import "encoding/json"

type UpdateSettingRequest struct {
	Value           json.RawMessage `json:"value"`
	Content         json.RawMessage `json:"content"`
	ExpectedVersion int             `json:"expectedVersion"`
	Reason          string          `json:"reason"`
}

func (request UpdateSettingRequest) EffectiveValue() json.RawMessage {
	if len(request.Value) > 0 {
		return request.Value
	}
	return request.Content
}

type RestoreSettingRequest struct {
	ExpectedVersion int    `json:"expectedVersion"`
	Reason          string `json:"reason"`
}
