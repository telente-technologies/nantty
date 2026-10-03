package createaddress

import (
	"github.com/google/uuid"

	"zudomart/modules/users/src/modules/addresses/models"
)

type Command struct {
	AccountId uuid.UUID
	Input     models.AddressInput
}
