package appeallivehold

type Command struct {
	UserId  string
	LiveId  string
	Message string
}

type Result struct {
	Status     string `json:"status"`
	IncidentId string `json:"incidentId"`
}
