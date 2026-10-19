package setrecordingrepost

import "github.com/google/uuid"

type Command struct {
	RecordingId uuid.UUID
	PostId      string
}
