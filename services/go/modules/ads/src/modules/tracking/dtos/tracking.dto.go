package dtos

type AdEventDto struct {
	EventId        string `json:"eventId"`
	Token          string `json:"token"`
	Type           string `json:"type"`
	WatchMs        int    `json:"watchMs"`
	VisiblePercent int    `json:"visiblePercent"`
	OccurredAt     string `json:"occurredAt"`
	CampaignId     string `json:"campaignId"`
	Placement      string `json:"placement"`
	ItemId         string `json:"itemId"`
}

type RecordAdEventsRequest struct {
	Events []AdEventDto `json:"events"`
}

type RejectedEvent struct {
	Index  int    `json:"index"`
	Reason string `json:"reason"`
}

type RecordAdEventsResponse struct {
	Accepted   int             `json:"accepted"`
	Duplicates int             `json:"duplicates"`
	Rejected   []RejectedEvent `json:"rejected"`
}
