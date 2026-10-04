package submitcontentreport

type Command struct {
	ReporterId    string
	TargetType    string
	TargetId      string
	Reason        string
	Details       string
	AuthorId      string
	SourceEventId string
	OffsetSeconds *float64
	FrameRef      string
}

type Result struct {
	Id        string `json:"id"`
	Status    string `json:"status"`
	Duplicate bool   `json:"-"`
}
