package saveautomationrule

import (
	"encoding/json"

	"zudomart/platform/staffauth"
)

type Command struct {
	Staff           staffauth.Staff
	IpAddress       string
	RequestId       string
	RuleId          string
	ExpectedVersion *int
	Reason          string
	Content         json.RawMessage
}
