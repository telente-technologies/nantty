package services

import (
	"encoding/json"

	adminerrors "zudomart/modules/admin/src/errors"
)

const SellerSalesCapKey = "seller.unverifiedSalesCap"

type SellerSalesCap struct {
	CapsMinor map[string]int64 `json:"capsMinor"`
}

func validateSellerSalesCap(raw json.RawMessage) (json.RawMessage, error) {
	var value SellerSalesCap
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if len(value.CapsMinor) == 0 || len(value.CapsMinor) > 50 {
		return nil, adminerrors.Unprocessable("capsMinor needs 1 to 50 currencies.")
	}
	for currency, amount := range value.CapsMinor {
		if !currencyCodePattern.MatchString(currency) || amount < 0 || amount > 1_000_000_000_000 {
			return nil, adminerrors.Unprocessable("Each cap needs an ISO 4217 currency and a whole amount in minor units from 0 to 1,000,000,000,000.")
		}
	}
	return canonicalJson(value)
}
