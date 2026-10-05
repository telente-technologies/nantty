package listproductoptions

import "zudomart/platform/commerceports"

type Query struct {
	Store commerceports.StoreAccess
	Text  string
}
