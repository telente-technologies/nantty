package grantstepup

import "encoding/json"

type Command struct {
	StaffId    string
	SessionId  string
	Method     string
	Code       string
	Credential json.RawMessage
}
