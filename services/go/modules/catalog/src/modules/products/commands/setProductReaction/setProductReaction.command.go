package setproductreaction

import "github.com/google/uuid"

type Command struct {
	AccountId uuid.UUID
	ProductId uuid.UUID
	Kind      string
	Active    bool
}
