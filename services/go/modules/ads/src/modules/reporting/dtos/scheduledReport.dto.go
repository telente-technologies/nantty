package dtos

type ScheduledReport struct {
	Id         string   `json:"id"`
	Name       string   `json:"name"`
	Recipients []string `json:"recipients"`
	Frequency  string   `json:"frequency"`
	Breakdown  string   `json:"breakdown"`
	Metrics    []string `json:"metrics"`
	NextSendAt string   `json:"nextSendAt"`
	CreatedAt  string   `json:"createdAt"`
}

type ScheduledReportInput struct {
	Name       string   `json:"name"`
	Recipients []string `json:"recipients"`
	Frequency  string   `json:"frequency"`
	Breakdown  string   `json:"breakdown"`
	Metrics    []string `json:"metrics"`
}
