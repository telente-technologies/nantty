package issuestrike

type Command struct {
	AccountId     string
	Kind          string
	Policy        string
	Reason        string
	Source        string
	IssuedById    string
	IssuedByName  string
	ReferenceType string
	ReferenceId   string
	ExpiresInDays int
}

type Result struct {
	Id                string `json:"id"`
	Created           bool   `json:"created"`
	ActiveStrikeCount int    `json:"activeStrikeCount"`
	IsRepeatInfringer bool   `json:"isRepeatInfringer"`
}
