package listsellerreturns

import "github.com/google/uuid"

type Query struct {
	StoreId *uuid.UUID
	BuyerId *uuid.UUID
	OrderId *uuid.UUID
	Status  string
	Cursor  string
	Limit   int
}
