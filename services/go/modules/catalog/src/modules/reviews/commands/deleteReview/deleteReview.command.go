package deletereview

import "github.com/google/uuid"

type Command struct {
	AccountId uuid.UUID
	ReviewId  uuid.UUID
}
