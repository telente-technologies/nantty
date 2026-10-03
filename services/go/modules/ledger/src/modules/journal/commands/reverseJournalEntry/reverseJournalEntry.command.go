package reversejournalentry

import "github.com/google/uuid"

type Command struct {
	EntryId      uuid.UUID
	Reason       string
	ActorStaffId string
}
