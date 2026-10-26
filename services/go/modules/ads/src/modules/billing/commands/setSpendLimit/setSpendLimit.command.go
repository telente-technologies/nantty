package setspendlimit

import (
	"github.com/google/uuid"

	"nantty/modules/ads/src/types"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Amount    *types.Money
}
