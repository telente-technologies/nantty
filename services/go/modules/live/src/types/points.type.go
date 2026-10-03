package types

type EngagementAward struct {
	Awarded              int64 `json:"awarded"`
	TotalPoints          int64 `json:"totalPoints"`
	LikePointsThisMinute int   `json:"likePointsThisMinute"`
}

type ViewerLivePoints struct {
	TotalPoints          int64 `json:"totalPoints"`
	LikePointsThisMinute int   `json:"likePointsThisMinute"`
}

type RankingQuery struct {
	Board       string
	Scope       string
	CountryCode string
	CategoryId  string
	Period      string
	Cursor      int
	Limit       int
}

type RankingEntryView struct {
	Rank   int         `json:"rank"`
	User   UserSummary `json:"user"`
	Points int64       `json:"points"`
}

type RankingsView struct {
	Data       []RankingEntryView `json:"data"`
	NextCursor *string            `json:"nextCursor"`
}
