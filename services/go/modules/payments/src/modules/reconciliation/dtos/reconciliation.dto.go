package dtos

import "time"

type ReconcileProviderSettlementsRequestDto struct {
	Provider string    `json:"provider"`
	From     time.Time `json:"from"`
	To       time.Time `json:"to"`
}
