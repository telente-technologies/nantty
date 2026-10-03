package removepayoutaccount

import "github.com/google/uuid"

type Command struct {
	UserId          string
	PayoutAccountId uuid.UUID
}
