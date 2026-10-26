package addpasskey

import (
	"encoding/json"

	"nantty/platform/staffauth"
)

type Command struct {
	Actor      staffauth.Staff
	Label      string
	Credential json.RawMessage
}
