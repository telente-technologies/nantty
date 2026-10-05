package types

type ExperimentArm struct {
	AdSetId        string `json:"adSetId"`
	TrafficPercent int    `json:"trafficPercent"`
}

type ExperimentResult struct {
	WinnerAdSetId     *string `json:"winnerAdSetId"`
	ConfidencePercent int     `json:"confidencePercent"`
	Summary           string  `json:"summary"`
}

type RuleCondition struct {
	Metric   string  `json:"metric"`
	Operator string  `json:"operator"`
	Value    float64 `json:"value"`
	Window   string  `json:"window"`
}
