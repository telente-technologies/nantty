package completemfalogin

import "encoding/json"

type Command struct {
	ChallengeToken string
	Method         string
	Code           string
	Credential     json.RawMessage
}
