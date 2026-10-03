package events

const (
	StrikeIssuedType  = "strike.issued"
	StrikeRevokedType = "strike.revoked"
)

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
