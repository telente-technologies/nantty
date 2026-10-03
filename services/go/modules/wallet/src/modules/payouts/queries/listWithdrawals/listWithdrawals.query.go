package listwithdrawals

import "github.com/google/uuid"

type Query struct {
	UserId  string
	Status  string
	AfterId *uuid.UUID
	Limit   int
}
