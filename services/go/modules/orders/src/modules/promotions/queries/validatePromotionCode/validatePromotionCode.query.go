package validatepromotioncode

import "zudomart/platform/commerceports"

type Query struct {
	Store         commerceports.StoreAccess
	Code          string
	SubtotalMinor int64
}
