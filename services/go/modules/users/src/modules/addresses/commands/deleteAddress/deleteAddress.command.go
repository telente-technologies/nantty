package deleteaddress

import "github.com/google/uuid"

type Command struct {
	AccountId uuid.UUID
	AddressId uuid.UUID
}
