package decidechatreport

import "nantty/platform/staffauth"

type Command struct {
	Staff        staffauth.Staff
	IpAddress    string
	RequestId    string
	ReportId     string
	Action       string
	Reason       string
	DurationDays *int
}
