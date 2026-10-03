package requestaccountdeletion

import "github.com/google/uuid"

type Command struct {
	AccountId uuid.UUID
	Reason    string
}
