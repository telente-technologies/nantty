package dtos

type LiveNowWidgetItem struct {
	Id            string  `json:"id"`
	HostId        string  `json:"hostId"`
	HostName      string  `json:"hostName"`
	HostUsername  string  `json:"hostUsername"`
	HostAvatarUrl *string `json:"hostAvatarUrl"`
	Title         string  `json:"title"`
	Viewers       int     `json:"viewers"`
	StartedAt     *string `json:"startedAt"`
	DeepLink      string  `json:"deepLink"`
}

type LiveNowWidgetPayload struct {
	Lives       []LiveNowWidgetItem `json:"lives"`
	GeneratedAt string              `json:"generatedAt"`
}
