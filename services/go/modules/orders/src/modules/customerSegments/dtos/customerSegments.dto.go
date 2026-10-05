package dtos

import "zudomart/modules/orders/src/databases/schema"

type CustomerSegmentInput struct {
	Name        string                       `json:"name"`
	Description string                       `json:"description"`
	Rules       []schema.CustomerSegmentRule `json:"rules"`
}

type CustomerSegmentChanges struct {
	Name        *string                       `json:"name"`
	Description *string                       `json:"description"`
	Rules       *[]schema.CustomerSegmentRule `json:"rules"`
}
