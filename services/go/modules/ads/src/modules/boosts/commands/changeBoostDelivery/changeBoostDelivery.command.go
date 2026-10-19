package changeboostdelivery

import "github.com/google/uuid"

const (
	ActionPause  = "pause"
	ActionResume = "resume"
)

type Command struct {
	BoostId uuid.UUID
	UserId  uuid.UUID
	Action  string
}
