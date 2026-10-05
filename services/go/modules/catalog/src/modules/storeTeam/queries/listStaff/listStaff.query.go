package liststaff

import "zudomart/platform/commerceports"

type Query struct {
	Store  commerceports.StoreAccess
	Text   string
	Cursor string
	Limit  int
}
