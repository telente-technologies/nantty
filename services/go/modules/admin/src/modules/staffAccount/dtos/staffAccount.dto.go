package dtos

import "encoding/json"

type AddPasskeyRequest struct {
	Label      string          `json:"label"`
	Credential json.RawMessage `json:"credential"`
}

type RecordConsentRequest struct {
	PolicyVersion string          `json:"policyVersion"`
	DecidedAt     string          `json:"decidedAt"`
	Categories    map[string]bool `json:"categories"`
	Source        string          `json:"source"`
}
