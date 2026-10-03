package events

const (
	ContentVisibilityChangedType = "content.visibilityChanged"
	ReportClosedType             = "report.closed"
	UserWarnedType               = "user.warned"
)

type ContentVisibilityChangedData struct {
	TargetType  string `json:"targetType"`
	TargetId    string `json:"targetId"`
	OwnerId     string `json:"ownerId,omitempty"`
	Visibility  string `json:"visibility"`
	Source      string `json:"source"`
	ReferenceId string `json:"referenceId"`
	Reason      string `json:"reason"`
}
