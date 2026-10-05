package getmarketingoverview

import "zudomart/platform/commerceports"

type Query struct {
	Store                 commerceports.StoreAccess
	IncludesAdvancedTools bool
}
