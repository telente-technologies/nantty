package getselleraccess

import "github.com/google/uuid"

type Query struct {
	AccountId      uuid.UUID
	RequestedStore *uuid.UUID
}
