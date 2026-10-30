package models

import (
	"errors"
	"math/bits"
	"net/http"

	"nantty/platform/httpserver"
)

var (
	ErrTransferTooSmallForFee = httpserver.NewApiError(http.StatusUnprocessableEntity, "TRANSFER_TOO_SMALL", "This transfer is too small to cover the platform fee.")
	ErrCoinAmountOutOfRange   = errors.New("coin amount out of range")
	ErrNoPriceForCurrency     = httpserver.NewApiError(http.StatusUnprocessableEntity, "NO_PRICE_FOR_CURRENCY", "This coin package has no price in your currency.")
)

type CoinTransferSplit struct {
	FeeCoins int64
	NetCoins int64
}

func SplitCoinTransfer(coins, feeBps int64) (CoinTransferSplit, error) {
	if coins <= 0 || feeBps < 0 || feeBps >= 10_000 {
		return CoinTransferSplit{}, ErrCoinAmountOutOfRange
	}
	recipientShareBps := 10_000 - feeBps
	net := coins/10_000*recipientShareBps + coins%10_000*recipientShareBps/10_000
	if net <= 0 {
		return CoinTransferSplit{}, ErrTransferTooSmallForFee
	}
	return CoinTransferSplit{FeeCoins: coins - net, NetCoins: net}, nil
}

func ConvertCoinsToCashMinor(coins, cashValuePerCoinMinor int64) (int64, error) {
	if coins <= 0 || cashValuePerCoinMinor <= 0 {
		return 0, ErrCoinAmountOutOfRange
	}
	high, low := bits.Mul64(uint64(coins), uint64(cashValuePerCoinMinor))
	if high != 0 || low > 1<<63-1 {
		return 0, ErrCoinAmountOutOfRange
	}
	return int64(low), nil
}

type ChosenPrice struct {
	Currency    string
	AmountMinor int64
}

func ChooseCoinPackagePrice(prices map[string]int64, preferredCurrency string, canCharge func(string) bool) (ChosenPrice, error) {
	for _, currency := range []string{preferredCurrency, "USD"} {
		if amount, found := prices[currency]; found && amount > 0 && canCharge(currency) {
			return ChosenPrice{Currency: currency, AmountMinor: amount}, nil
		}
	}
	return ChosenPrice{}, ErrNoPriceForCurrency
}

type CoinClawback struct {
	RecoveredCoins int64
	ShortfallCoins int64
}

func SplitCoinClawback(spendableBalance, purchasedCoins int64) CoinClawback {
	recovered := min(max(spendableBalance, 0), purchasedCoins)
	return CoinClawback{RecoveredCoins: recovered, ShortfallCoins: purchasedCoins - recovered}
}

// ProportionalCoinChargeback returns the cumulative coin clawback target for a
// cumulative fiat chargeback amount. Flooring each dispute independently would
// lose fractional progress, so callers must pass the cumulative fiat amount.
func ProportionalCoinChargeback(cumulativeAmount, purchaseCoins, purchaseAmount int64) (int64, error) {
	if cumulativeAmount < 0 || purchaseCoins <= 0 || purchaseAmount <= 0 || cumulativeAmount > purchaseAmount {
		return 0, ErrCoinAmountOutOfRange
	}
	if cumulativeAmount == purchaseAmount {
		return purchaseCoins, nil
	}
	high, low := bits.Mul64(uint64(cumulativeAmount), uint64(purchaseCoins))
	quotient, _ := bits.Div64(high, low, uint64(purchaseAmount))
	return int64(quotient), nil
}

func CoinsForChannelPrice(priceMinor, channelFeeBps, netValuePerCoinMinor int64) (int64, error) {
	if priceMinor <= 0 || netValuePerCoinMinor <= 0 || channelFeeBps < 0 || channelFeeBps >= 10_000 {
		return 0, ErrCoinAmountOutOfRange
	}
	high, low := bits.Mul64(uint64(priceMinor), uint64(10_000-channelFeeBps))
	if high != 0 || low > 1<<63-1 {
		return 0, ErrCoinAmountOutOfRange
	}
	return int64(low) / 10_000 / netValuePerCoinMinor, nil
}
