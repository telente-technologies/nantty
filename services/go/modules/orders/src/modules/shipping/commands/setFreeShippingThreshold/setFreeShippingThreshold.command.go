package setfreeshippingthreshold

import "nantty/platform/commerceports"

type Command struct {
	Store          commerceports.StoreAccess
	ThresholdMinor *int64
}
