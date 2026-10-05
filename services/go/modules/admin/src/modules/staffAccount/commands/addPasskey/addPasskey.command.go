package addpasskey

import (
	"encoding/json"

	"zudomart/platform/staffauth"
)

type Command struct {
	Actor      staffauth.Staff
	Label      string
	Credential json.RawMessage
}
