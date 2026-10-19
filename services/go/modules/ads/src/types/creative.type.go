package types

type CreativeSource struct {
	Type string `json:"type"`
	Id   string `json:"id"`
}

type CreativeUtm struct {
	Source   string `json:"source,omitempty"`
	Medium   string `json:"medium,omitempty"`
	Campaign string `json:"campaign,omitempty"`
	Content  string `json:"content,omitempty"`
	Term     string `json:"term,omitempty"`
}

type CreativeDestination struct {
	Type     string       `json:"type"`
	TargetId *string      `json:"targetId"`
	Url      *string      `json:"url"`
	Utm      *CreativeUtm `json:"utm,omitempty"`
}

type CreativeCardInput struct {
	MediaId      string              `json:"mediaId"`
	Headline     string              `json:"headline"`
	Description  string              `json:"description"`
	CallToAction string              `json:"callToAction"`
	Destination  CreativeDestination `json:"destination"`
}

type CreativeCard struct {
	Media        CreativeMedia       `json:"media"`
	Headline     string              `json:"headline"`
	Description  string              `json:"description"`
	CallToAction string              `json:"callToAction"`
	Destination  CreativeDestination `json:"destination"`
}

type CreativeApp struct {
	AppName         string   `json:"appName"`
	IconMediaId     string   `json:"iconMediaId,omitempty"`
	IconUrl         string   `json:"iconUrl,omitempty"`
	Rating          *float64 `json:"rating"`
	IosStoreUrl     string   `json:"iosStoreUrl"`
	AndroidStoreUrl string   `json:"androidStoreUrl"`
	WebFallbackUrl  string   `json:"webFallbackUrl"`
	IosDeepLink     string   `json:"iosDeepLink"`
	AndroidDeepLink string   `json:"androidDeepLink"`
}

type CreativeClickLinks struct {
	Media string   `json:"media,omitempty"`
	Cta   string   `json:"cta,omitempty"`
	Cards []string `json:"cards,omitempty"`
}

type CreativeInput struct {
	Format         string              `json:"format"`
	Type           string              `json:"type"`
	MediaClickable bool                `json:"mediaClickable"`
	Cards          []CreativeCardInput `json:"cards"`
	App            *CreativeApp        `json:"app"`
	Source         CreativeSource      `json:"source"`
	MediaIds       []string            `json:"mediaIds"`
	Headline       string              `json:"headline"`
	PrimaryText    string              `json:"primaryText"`
	CallToAction   string              `json:"callToAction"`
	Destination    CreativeDestination `json:"destination"`
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
	Format         string              `json:"format"`
	Type           string              `json:"type"`
	MediaClickable bool                `json:"mediaClickable"`
	Cards          []CreativeCard      `json:"cards,omitempty"`
	App            *CreativeApp        `json:"app,omitempty"`
	Source         CreativeSource      `json:"source"`
	Media          []CreativeMedia     `json:"media"`
	Headline       string              `json:"headline"`
	PrimaryText    string              `json:"primaryText"`
	CallToAction   string              `json:"callToAction"`
	Destination    CreativeDestination `json:"destination"`
	Identity       CreativeIdentity    `json:"identity"`
	Product        map[string]any      `json:"product"`
	Live           map[string]any      `json:"live,omitempty"`
	Promoted       *CreativePromoted   `json:"promoted,omitempty"`
}

type CreativePromoted struct {
	Kind           string  `json:"kind"`
	Id             string  `json:"id"`
	Name           string  `json:"name"`
	Handle         string  `json:"handle"`
	AvatarUrl      *string `json:"avatarUrl"`
	Verified       bool    `json:"verified"`
	CheckmarkColor string  `json:"checkmarkColor,omitempty"`
	Private        bool    `json:"private"`
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
