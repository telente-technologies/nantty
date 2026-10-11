package types

import "github.com/google/uuid"

type CommentMentionInput struct {
	UserId string `json:"userId"`
	Start  int    `json:"start"`
	Length int    `json:"length"`
}

type CommentMentionView struct {
	UserId   string `json:"userId"`
	Username string `json:"username"`
	Start    int    `json:"start"`
	Length   int    `json:"length"`
}

type PostLiveCommentInput struct {
	Text      string
	Mentions  []CommentMentionInput
	ReplyToId string
}

type LiveCommentView struct {
	Id        string               `json:"id"`
	LiveId    string               `json:"liveId"`
	Author    UserSummary          `json:"author"`
	Text      string               `json:"text"`
	Kind      string               `json:"kind"`
	CreatedAt string               `json:"createdAt"`
	Mentions  []CommentMentionView `json:"mentions"`
	ReplyToId *string              `json:"replyToId"`
	Pinned    bool                 `json:"pinned"`
}

type RoomSettingsInput struct {
	CommentsEnabled *bool
	SlowModeSeconds *int
	BlockedWords    *[]string
	CommentAudience *string
}

type RoomSettingsView struct {
	LiveId          string           `json:"liveId"`
	CommentsEnabled bool             `json:"commentsEnabled"`
	SlowModeSeconds int              `json:"slowModeSeconds"`
	CommentAudience string           `json:"commentAudience"`
	PinnedComment   *LiveCommentView `json:"pinnedComment"`
	BlockedWords    []string         `json:"blockedWords,omitempty"`
	MyRole          string           `json:"myRole"`
	MutedUntil      *string          `json:"mutedUntil,omitempty"`
	RecordEnabled   *bool            `json:"recordEnabled,omitempty"`
}

type ModeratorView struct {
	User      UserSummary `json:"user"`
	GrantedAt string      `json:"grantedAt"`
}

type RestrictionView struct {
	LiveId    string  `json:"liveId"`
	UserId    string  `json:"userId"`
	Kind      string  `json:"kind"`
	ExpiresAt *string `json:"expiresAt"`
}

type StreamKeyView struct {
	LiveId    string `json:"liveId"`
	Protocol  string `json:"protocol"`
	IngestUrl string `json:"ingestUrl"`
	StreamKey string `json:"streamKey"`
	KeyHint   string `json:"streamKeyHint"`
	IssuedAt  string `json:"issuedAt"`
}

type StudioLiveView struct {
	Id            string            `json:"id"`
	Title         string            `json:"title"`
	Category      string            `json:"category"`
	State         string            `json:"state"`
	CreatedAt     string            `json:"createdAt"`
	StartedAt     *string           `json:"startedAt"`
	EndedAt       *string           `json:"endedAt"`
	ScheduledAt   *string           `json:"scheduledAt"`
	Viewers       int               `json:"viewers"`
	PeakViewers   int               `json:"peakViewers"`
	StreamKeyHint *string           `json:"streamKeyHint"`
	IngestProto   *string           `json:"ingestProtocol"`
	HlsUrl        *string           `json:"hlsUrl"`
	Earnings      StudioEarnings    `json:"earnings"`
	RecordEnabled bool              `json:"recordEnabled"`
	Visibility    string            `json:"visibility"`
	Products      []LiveProductView `json:"products"`
}

type StudioEarnings struct {
	Coins     int64 `json:"coins"`
	GiftCount int64 `json:"giftCount"`
}

type RecordingView struct {
	Id              string  `json:"id"`
	LiveId          string  `json:"liveId"`
	State           string  `json:"state"`
	DurationSeconds int64   `json:"durationSeconds"`
	SizeBytes       int64   `json:"sizeBytes"`
	CreatedAt       string  `json:"createdAt"`
	CompletedAt     *string `json:"completedAt"`
	PlaybackUrl     *string `json:"playbackUrl"`
}

type OverlayLayer struct {
	Id         string   `json:"id"`
	Type       string   `json:"type"`
	Name       string   `json:"name"`
	X          float64  `json:"x"`
	Y          float64  `json:"y"`
	Width      float64  `json:"width"`
	Height     float64  `json:"height"`
	ZIndex     int      `json:"zIndex"`
	Opacity    float64  `json:"opacity"`
	Text       *string  `json:"text,omitempty"`
	FontSize   *float64 `json:"fontSize,omitempty"`
	Color      *string  `json:"color,omitempty"`
	Background *string  `json:"background,omitempty"`
	Src        *string  `json:"src,omitempty"`
	Radius     *float64 `json:"radius,omitempty"`
}

type OverlaySceneView struct {
	Id          string         `json:"id"`
	LiveId      string         `json:"liveId"`
	Name        string         `json:"name"`
	Layers      []OverlayLayer `json:"layers"`
	IsMain      bool           `json:"isMain"`
	Published   bool           `json:"published"`
	PublishedAt *string        `json:"publishedAt"`
	Revision    int            `json:"revision"`
	UpdatedAt   string         `json:"updatedAt"`
}

type PublicOverlaySceneView struct {
	Scene PublicOverlayScene `json:"scene"`
	Live  PublicOverlayLive  `json:"live"`
}

type PublicOverlayScene struct {
	Id     string         `json:"id"`
	LiveId string         `json:"liveId"`
	Name   string         `json:"name"`
	Layers []OverlayLayer `json:"layers"`
}

type PublicOverlayLive struct {
	Id    string `json:"id"`
	Title string `json:"title"`
	State string `json:"state"`
}

type OverlaySceneInput struct {
	Name    *string
	Layers  *[]OverlayLayer
	Publish *bool
}

type TopicAccessView struct {
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason"`
	Role    string `json:"role,omitempty"`
	LiveId  string `json:"liveId,omitempty"`
}

type ShareCardView struct {
	Availability string       `json:"availability"`
	Title        *string      `json:"title"`
	Subtitle     *string      `json:"subtitle"`
	ImageUrl     *string      `json:"imageUrl"`
	IsLive       bool         `json:"isLive"`
	Status       string       `json:"status,omitempty"`
	ViewerCount  *int         `json:"viewerCount"`
	Host         *UserSummary `json:"host,omitempty"`
}

type LiveAdEligibilityView struct {
	Eligible    bool     `json:"eligible"`
	Reason      string   `json:"reason,omitempty"`
	Placements  []string `json:"placements"`
	Maximum     int      `json:"maxInterruptions"`
	MinInterval int      `json:"minIntervalMinutes"`
	Indicator   bool     `json:"showAdIndicator"`
	Sponsorship *string  `json:"sponsorshipLine"`
}

type PresenceChangeInput struct {
	Joined []string `json:"joined"`
	Left   []string `json:"left"`
}

type HostDefaultsInput struct {
	CommentsEnabled *bool
	CommentAudience *string
	SlowModeSeconds *int
	BlockedWords    *[]string
	ModeratorIds    *[]uuid.UUID
}

type HostDefaultsView struct {
	CommentsEnabled bool          `json:"commentsEnabled"`
	CommentAudience string        `json:"commentAudience"`
	SlowModeSeconds int           `json:"slowModeSeconds"`
	BlockedWords    []string      `json:"blockedWords"`
	Moderators      []UserSummary `json:"moderators"`
	UpdatedAt       *string       `json:"updatedAt"`
}

type IngressHealthView struct {
	Protocol         string   `json:"protocol"`
	Status           string   `json:"status"`
	Error            *string  `json:"error"`
	VideoBitrateKbps *int     `json:"videoBitrateKbps"`
	AudioBitrateKbps *int     `json:"audioBitrateKbps"`
	Width            *int     `json:"width"`
	Height           *int     `json:"height"`
	Framerate        *float64 `json:"framerate"`
}

type StreamHealthView struct {
	LiveId      string             `json:"liveId"`
	State       string             `json:"state"`
	Viewers     int                `json:"viewers"`
	PeakViewers int                `json:"peakViewers"`
	StartedAt   *string            `json:"startedAt"`
	Ingress     *IngressHealthView `json:"ingress"`
	CheckedAt   string             `json:"checkedAt"`
}
