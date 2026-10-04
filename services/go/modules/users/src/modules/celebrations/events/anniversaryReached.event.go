package events

const AnniversaryReachedType = "account.anniversaryReached"

type AnniversaryStats struct {
	Posts     *int `json:"posts,omitempty"`
	Lives     *int `json:"lives,omitempty"`
	Followers *int `json:"followers,omitempty"`
	Orders    *int `json:"orders,omitempty"`
}

type AnniversaryReachedData struct {
	AccountId string            `json:"accountId"`
	Years     int               `json:"years"`
	LocalDate string            `json:"localDate"`
	Timezone  string            `json:"timezone"`
	JoinedAt  string            `json:"joinedAt"`
	Stats     *AnniversaryStats `json:"stats,omitempty"`
}
