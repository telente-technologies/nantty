package setfreeshippingthreshold

import "zudomart/platform/commerceports"

type Command struct {
	Store          commerceports.StoreAccess
	ThresholdMinor *int64
}
