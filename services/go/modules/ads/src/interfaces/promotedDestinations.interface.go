package interfaces

import "context"

type PromotedDestination struct {
	Kind           string  `json:"kind"`
	Id             string  `json:"id"`
	Name           string  `json:"name"`
	Handle         string  `json:"handle"`
	AvatarUrl      *string `json:"avatarUrl"`
	Verified       bool    `json:"verified"`
	CheckmarkColor string  `json:"checkmarkColor,omitempty"`
	Private        bool    `json:"private"`
	Available      bool    `json:"available"`
}

type PromotedDestinationDirectory interface {
	LookupDestinations(ctx context.Context, kind string, ids []string) (map[string]PromotedDestination, error)
	ListPromotableDestinations(ctx context.Context, kind, ownerUserId string) ([]PromotedDestination, error)
}
