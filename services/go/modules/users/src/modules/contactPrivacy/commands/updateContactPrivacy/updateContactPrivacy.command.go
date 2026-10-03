package updatecontactprivacy

import "github.com/google/uuid"

type Command struct {
	AccountId     uuid.UUID
	WhoCanMessage *string
	WhoCanMention *string
}
