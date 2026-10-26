package listproductoptions

import "nantty/platform/commerceports"

type Query struct {
	Store commerceports.StoreAccess
	Text  string
}
