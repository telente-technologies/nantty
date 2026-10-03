package publishpolicyversion

import "time"

type Command struct {
	StaffId     string
	StaffRole   string
	Kind        string
	Version     string
	EffectiveAt time.Time
	Summary     string
	ContentUrl  string
	IpAddress   string
	UserAgent   string
	RequestId   string
}
