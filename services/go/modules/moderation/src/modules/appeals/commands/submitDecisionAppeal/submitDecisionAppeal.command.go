package submitdecisionappeal

type Command struct {
	AccountId string
	ReportId  string
	Message   string
}

type Result struct {
	Status   string `json:"status"`
	AppealId string `json:"appealId"`
}
