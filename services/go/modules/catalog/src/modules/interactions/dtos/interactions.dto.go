package dtos

import "time"

type InteractionRecord struct {
	Event      string         `json:"event"`
	Payload    map[string]any `json:"payload"`
	OccurredAt time.Time      `json:"occurredAt"`
}

type InteractionBatchRequest struct {
	Events []InteractionRecord `json:"events"`
}

type InteractionBatchResult struct {
	Accepted int `json:"accepted"`
	Dropped  int `json:"dropped"`
}
