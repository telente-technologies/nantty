package recordlivereport

type Command struct {
	SourceEventId string
	ReporterId    string
	LiveId        string
	HostId        string
	Reason        string
	Details       string
	OffsetSeconds *float64
	FrameRef      string
}

type Result struct {
	IncidentId string
	Priority   string
	Surge      bool
}
