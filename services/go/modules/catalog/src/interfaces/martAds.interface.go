package interfaces

import (
	"context"

	"github.com/google/uuid"
)

type MartAdRequest struct {
	Viewer  uuid.UUID
	Country string
}

type MartAdClickLinks struct {
	Media string   `json:"media,omitempty"`
	Cta   string   `json:"cta,omitempty"`
	Cards []string `json:"cards,omitempty"`
}

type MartAd struct {
	AdId            string
	ImpressionToken string
	Label           string
	AdvertiserName  string
	ProductId       string
	Headline        string
	PrimaryText     string
	CallToAction    string
	AdType          string
	ImageUrl        string
	ClickLinks      *MartAdClickLinks
}

type MartAdDecider interface {
	DecideMartTile(ctx context.Context, request MartAdRequest) (*MartAd, error)
}
