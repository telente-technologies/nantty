package updateaddress

import (
	"github.com/google/uuid"

	"zudomart/modules/users/src/modules/addresses/models"
)

type Command struct {
	AccountId uuid.UUID
	AddressId uuid.UUID
	Patch     models.AddressPatch
}
