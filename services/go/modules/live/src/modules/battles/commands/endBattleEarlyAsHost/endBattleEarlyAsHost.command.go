package endbattleearlyashost

import (
	"nantty/modules/live/src/types"

	"github.com/google/uuid"
)

type Command struct {
	Actor    types.Actor
	BattleId uuid.UUID
}
