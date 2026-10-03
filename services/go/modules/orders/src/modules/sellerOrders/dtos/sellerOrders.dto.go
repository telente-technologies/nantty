package dtos

import "time"

type ReasonRequest struct {
	Reason string `json:"reason"`
}

type StatusRequest struct {
	Status string `json:"status"`
}

type FulfilmentRequest struct {
	Courier        string  `json:"courier"`
	TrackingNumber string  `json:"trackingNumber"`
	TrackingUrl    *string `json:"trackingUrl"`
	FromLocationId string  `json:"fromLocationId"`
}

type NoteRequest struct {
	Body string `json:"body"`
}

type ShipmentPatchRequest struct {
	RiderName           *string    `json:"riderName"`
	RiderPhone          *string    `json:"riderPhone"`
	EstimatedDeliveryAt *time.Time `json:"estimatedDeliveryAt"`
	Retry               bool       `json:"retry"`
}

type AttemptRequest struct {
	Outcome string `json:"outcome"`
	Note    string `json:"note"`
}
