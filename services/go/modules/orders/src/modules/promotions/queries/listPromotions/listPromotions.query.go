package listpromotions

import "nantty/platform/commerceports"

type Query struct {
	Store  commerceports.StoreAccess
	Status string
	Kind   string
	Text   string
	Cursor string
	Limit  int
}
