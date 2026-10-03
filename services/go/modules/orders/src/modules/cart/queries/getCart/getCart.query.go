package getcart

import (
	"github.com/google/uuid"
)

type Query struct {
	AccountId uuid.UUID
	AddressId *uuid.UUID
}
