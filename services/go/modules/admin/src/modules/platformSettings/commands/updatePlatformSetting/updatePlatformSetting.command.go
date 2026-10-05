package updateplatformsetting

import (
	"encoding/json"

	"zudomart/platform/staffauth"
)

type Command struct {
	Actor           staffauth.Staff
	Key             string
	Value           json.RawMessage
	ExpectedVersion int
	Reason          string
	RestoreVersion  int
}
