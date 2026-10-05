package searchzudomartusers

import (
	"github.com/google/uuid"

	"zudomart/platform/commerceports"
)

type Query struct {
	Store       commerceports.StoreAccess
	CallerId    uuid.UUID
	Text        string
	ExcludeTeam bool
}
