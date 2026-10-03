package setfundingmode

import "github.com/google/uuid"

type Command struct {
	AccountId   uuid.UUID
	UserId      uuid.UUID
	FundingMode string
}
