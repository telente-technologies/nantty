package liststaffwithdrawals

import "github.com/google/uuid"

type Query struct {
	Status  string
	Search  string
	AfterId *uuid.UUID
	Limit   int
}
