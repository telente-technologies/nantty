package types

type CreativeSource struct {
	Type string `json:"type"`
	Id   string `json:"id"`
}

type CreativeDestination struct {
	Type     string  `json:"type"`
	TargetId *string `json:"targetId"`
	Url      *string `json:"url"`
}

type CreativeInput struct {
	Format       string              `json:"format"`
	Source       CreativeSource      `json:"source"`
	MediaIds     []string            `json:"mediaIds"`
	Headline     string              `json:"headline"`
	PrimaryText  string              `json:"primaryText"`
	CallToAction string              `json:"callToAction"`
	Destination  CreativeDestination `json:"destination"`
}

type CreativeMedia struct {
	Id              string  `json:"id"`
	Kind            string  `json:"kind"`
	Url             string  `json:"url"`
	PosterUrl       *string `json:"posterUrl"`
	Width           int     `json:"width"`
	Height          int     `json:"height"`
	DurationSeconds *int    `json:"durationSeconds"`
}

type CreativeIdentity struct {
	Name             string  `json:"name"`
	Handle           string  `json:"handle"`
	AvatarUrl        *string `json:"avatarUrl"`
	VerifiedBusiness bool    `json:"verifiedBusiness"`
}

type Creative struct {
	Format       string              `json:"format"`
	Source       CreativeSource      `json:"source"`
	Media        []CreativeMedia     `json:"media"`
	Headline     string              `json:"headline"`
	PrimaryText  string              `json:"primaryText"`
	CallToAction string              `json:"callToAction"`
	Destination  CreativeDestination `json:"destination"`
	Identity     CreativeIdentity    `json:"identity"`
	Product      map[string]any      `json:"product"`
	Live         map[string]any      `json:"live,omitempty"`
}

type StoredCreative struct {
	Input    CreativeInput `json:"input"`
	Resolved Creative      `json:"resolved"`
}

type AutoCheckFlag struct {
	PolicyCategoryId string `json:"policyCategoryId"`
	Label            string `json:"label"`
	Severity         string `json:"severity"`
	Detail           string `json:"detail"`
}
