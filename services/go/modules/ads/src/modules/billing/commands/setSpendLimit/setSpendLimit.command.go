package setspendlimit

import (
	"github.com/google/uuid"

	"zudomart/modules/ads/src/types"
)

type Command struct {
	AccountId uuid.UUID
	UserId    uuid.UUID
	Amount    *types.Money
}
