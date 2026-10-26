package liststaff

import "nantty/platform/commerceports"

type Query struct {
	Store  commerceports.StoreAccess
	Text   string
	Cursor string
	Limit  int
}
