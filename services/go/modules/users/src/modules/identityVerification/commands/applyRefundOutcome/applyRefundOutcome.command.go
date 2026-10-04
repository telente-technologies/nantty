package applyrefundoutcome

type Command struct {
	EventType string
	CaseId    string `json:"caseId"`
}
