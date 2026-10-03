package confirmboostpayment

import "github.com/google/uuid"

type Command struct {
	BoostId          uuid.UUID
	PaymentReference string
}
