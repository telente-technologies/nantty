package integrations

import (
	"errors"

	"zudomart/modules/payments/src/interfaces"
)

func applyDynamicSplit(body map[string]any, shares []interfaces.SplitShare, amountMinor int64) error {
	if len(shares) == 0 {
		return nil
	}
	subaccounts := make([]map[string]any, 0, len(shares))
	var total int64
	for _, share := range shares {
		if share.Subaccount == "" || share.ShareMinor <= 0 {
			return errors.New("paystack: every split share needs a subaccount and a positive amount")
		}
		total += share.ShareMinor
		subaccounts = append(subaccounts, map[string]any{"subaccount": share.Subaccount, "share": share.ShareMinor})
	}
	if total > amountMinor {
		return errors.New("paystack: the split shares exceed the transaction amount")
	}
	body["split"] = map[string]any{"type": "flat", "bearer_type": "account", "subaccounts": subaccounts}
	return nil
}
