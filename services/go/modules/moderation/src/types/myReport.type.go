package types

type MyReportItem struct {
	Id          string  `json:"id"`
	Kind        string  `json:"kind"`
	TargetType  string  `json:"targetType"`
	TargetId    *string `json:"targetId"`
	TargetLabel string  `json:"targetLabel"`
	Reason      string  `json:"reason"`
	Status      string  `json:"status"`
	OutcomeNote *string `json:"outcomeNote"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}
