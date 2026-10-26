package searchnanttyusers

import (
	"github.com/google/uuid"

	"nantty/platform/commerceports"
)

type Query struct {
	Store       commerceports.StoreAccess
	CallerId    uuid.UUID
	Text        string
	ExcludeTeam bool
}
