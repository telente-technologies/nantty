package events

const (
	StrikeIssuedType  = "strike.issued"
	StrikeRevokedType = "strike.revoked"
	StrikeExpiredType = "strike.expired"
)

type StrikeExpiredData struct {
	StrikeId          string `json:"strikeId"`
	AccountId         string `json:"accountId"`
	Kind              string `json:"kind"`
	Policy            string `json:"policy"`
	Source            string `json:"source"`
	ExpiredAt         string `json:"expiredAt"`
	ActiveStrikeCount int    `json:"activeStrikeCount"`
}

type StrikeIssuedData struct {
	StrikeId          string  `json:"strikeId"`
	AccountId         string  `json:"accountId"`
	Kind              string  `json:"kind"`
	Policy            string  `json:"policy"`
	Source            string  `json:"source"`
	ExpiresAt         *string `json:"expiresAt"`
	ActiveStrikeCount int     `json:"activeStrikeCount"`
	IsRepeatInfringer bool    `json:"isRepeatInfringer"`
}

type StrikeRevokedData struct {
	StrikeId          string `json:"strikeId"`
	AccountId         string `json:"accountId"`
	Reason            string `json:"reason"`
	ActiveStrikeCount int    `json:"activeStrikeCount"`
}
