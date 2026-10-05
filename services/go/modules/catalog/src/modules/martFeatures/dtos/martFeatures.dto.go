package dtos

import (
	"time"

	"zudomart/modules/catalog/src/utils"
)

type FeatureRequest struct {
	Title       *string              `json:"title"`
	Subtitle    utils.NullableString `json:"subtitle"`
	Kind        *string              `json:"kind"`
	ImageId     *string              `json:"imageId"`
	TargetType  *string              `json:"targetType"`
	TargetValue *string              `json:"targetValue"`
	Countries   []string             `json:"countries"`
	StartsAt    *time.Time           `json:"startsAt"`
	EndsAt      utils.NullableString `json:"endsAt"`
	Reason      string               `json:"reason"`
}

type MoveRequest struct {
	Direction string `json:"direction"`
}

type ReasonRequest struct {
	Reason string `json:"reason"`
}

type MartHomeFeature struct {
	Id          string     `json:"id"`
	Title       string     `json:"title"`
	Subtitle    *string    `json:"subtitle"`
	Kind        string     `json:"kind"`
	ImageId     string     `json:"imageId"`
	ImageUrl    string     `json:"imageUrl"`
	TargetType  string     `json:"targetType"`
	TargetValue string     `json:"targetValue"`
	Countries   []string   `json:"countries"`
	StartsAt    time.Time  `json:"startsAt"`
	EndsAt      *time.Time `json:"endsAt"`
	Priority    int        `json:"priority"`
	IsPublished bool       `json:"isPublished"`
	Status      string     `json:"status"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type LibraryImage struct {
	Id    string `json:"id"`
	Label string `json:"label"`
	Url   string `json:"url"`
}

type HighlightReason struct {
	Code  string `json:"code"`
	Label string `json:"label"`
}

type HighlightRanking struct {
	Score  float64         `json:"score"`
	Reason HighlightReason `json:"reason"`
}

type MartHighlight struct {
	Id       string           `json:"id"`
	Kind     string           `json:"kind"`
	Title    string           `json:"title"`
	Subtitle *string          `json:"subtitle"`
	ImageUrl *string          `json:"imageUrl"`
	Target   map[string]any   `json:"target"`
	Ranking  HighlightRanking `json:"ranking"`
}
