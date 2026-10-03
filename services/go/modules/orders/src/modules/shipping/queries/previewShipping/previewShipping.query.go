package previewshipping

import "zudomart/platform/commerceports"

type Query struct {
	Store           commerceports.StoreAccess
	StateCode       string
	LgaName         string
	OrderTotalMinor int64
}
