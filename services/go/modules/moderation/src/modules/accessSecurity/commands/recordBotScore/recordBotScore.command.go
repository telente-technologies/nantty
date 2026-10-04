package recordbotscore

type Command struct {
	ScoreId      string   `json:"scoreId"`
	AccountId    string   `json:"accountId"`
	Score        float64  `json:"score"`
	ReasonCodes  []string `json:"reasonCodes"`
	ModelVersion string   `json:"modelVersion"`
	AdvisoryOnly bool     `json:"advisoryOnly"`
	GeneratedAt  string   `json:"generatedAt"`
}

type Result struct {
	SuspectedBot bool     `json:"suspectedBot"`
	Reasons      []string `json:"reasons"`
}
