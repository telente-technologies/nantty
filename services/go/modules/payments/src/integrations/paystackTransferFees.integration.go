package integrations

import (
	"strconv"
	"strings"

	"zudomart/modules/payments/src/interfaces"
)

type TransferFeeBand struct {
	UpToAmountMinor int64
	FeeMinor        int64
}

func DefaultPaystackTransferFeeBands() []TransferFeeBand {
	return []TransferFeeBand{{UpToAmountMinor: 500_000, FeeMinor: 1_000}, {UpToAmountMinor: 5_000_000, FeeMinor: 2_500}, {FeeMinor: 5_000}}
}

func ParseTransferFeeBands(raw string) []TransferFeeBand {
	var bands []TransferFeeBand
	for _, entry := range strings.Split(raw, ";") {
		limit, fee, found := strings.Cut(strings.TrimSpace(entry), ":")
		feeMinor, err := strconv.ParseInt(strings.TrimSpace(fee), 10, 64)
		if !found || err != nil || feeMinor < 0 {
			continue
		}
		if strings.TrimSpace(limit) == "*" {
			bands = append(bands, TransferFeeBand{FeeMinor: feeMinor})
			continue
		}
		upTo, err := strconv.ParseInt(strings.TrimSpace(limit), 10, 64)
		if err == nil && upTo > 0 {
			bands = append(bands, TransferFeeBand{UpToAmountMinor: upTo, FeeMinor: feeMinor})
		}
	}
	if len(bands) == 0 {
		return DefaultPaystackTransferFeeBands()
	}
	return bands
}

func QuoteTransferFee(bands []TransferFeeBand, amountMinor int64) int64 {
	for _, band := range bands {
		if band.UpToAmountMinor == 0 || amountMinor <= band.UpToAmountMinor {
			return band.FeeMinor
		}
	}
	return bands[len(bands)-1].FeeMinor
}

func (provider *PaystackProvider) QuotePayoutFee(currency string, amountMinor int64) (int64, error) {
	if currency != "NGN" {
		return 0, interfaces.ErrCurrencyNotSupported
	}
	return QuoteTransferFee(provider.settings.TransferFeeBands, amountMinor), nil
}
