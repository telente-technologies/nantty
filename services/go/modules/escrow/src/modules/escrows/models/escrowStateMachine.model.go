package models

import (
	"fmt"
	"math/big"
	"net/http"
	"slices"

	"zudomart/platform/httpserver"
	"zudomart/platform/money"
)

type EscrowStatus string

const (
	EscrowHeld              EscrowStatus = "held"
	EscrowDisputed          EscrowStatus = "disputed"
	EscrowReleased          EscrowStatus = "released"
	EscrowRefunded          EscrowStatus = "refunded"
	EscrowPartiallyRefunded EscrowStatus = "partiallyRefunded"
	EscrowClawedBack        EscrowStatus = "clawedBack"
)

var ErrEscrowAlreadyPartiallyRefunded = httpserver.NewApiError(http.StatusConflict, "ESCROW_ALREADY_PARTIALLY_REFUNDED", "This order was already partially refunded; a second partial refund is not allowed.")

var ErrEscrowFrozenByDispute = httpserver.NewApiError(http.StatusConflict, "ESCROW_DISPUTED", "This order is under dispute; its funds stay frozen until the dispute is resolved.")

var allowedEscrowTransitions = map[EscrowStatus][]EscrowStatus{
	EscrowHeld:              {EscrowReleased, EscrowRefunded, EscrowDisputed, EscrowPartiallyRefunded},
	EscrowDisputed:          {EscrowReleased, EscrowRefunded, EscrowPartiallyRefunded, EscrowHeld},
	EscrowReleased:          {EscrowRefunded, EscrowClawedBack},
	EscrowPartiallyRefunded: {EscrowRefunded},
}

func EscrowTransitionIsAllowed(from, to EscrowStatus) bool {
	return slices.Contains(allowedEscrowTransitions[from], to)
}

func AssertEscrowTransitionAllowed(from, to EscrowStatus) error {
	if EscrowTransitionIsAllowed(from, to) {
		return nil
	}
	return httpserver.NewApiError(http.StatusConflict, "ESCROW_INVALID_STATE", fmt.Sprintf("This escrow is %s and cannot become %s.", from, to))
}

type EscrowSplit struct {
	SellerAmountMinor int64
	CommissionMinor   int64
}

func SplitAmountBetweenSellerAndPlatform(amountMinor, commissionBps int64) (EscrowSplit, error) {
	if amountMinor < 0 || commissionBps < 0 || commissionBps > 10_000 {
		return EscrowSplit{}, fmt.Errorf("invalid split of %d at %d bps", amountMinor, commissionBps)
	}
	sellerShareBps := 10_000 - commissionBps
	amount := money.Money{AmountMinor: amountMinor, Currency: "USD"}
	shares, err := amount.AllocateByWeightsWithoutLosingMinorUnits([]int64{sellerShareBps, commissionBps})
	if err != nil {
		return EscrowSplit{}, fmt.Errorf("invalid split of %d at %d bps: %w", amountMinor, commissionBps, err)
	}
	return EscrowSplit{SellerAmountMinor: shares[0].AmountMinor, CommissionMinor: shares[1].AmountMinor}, nil
}

type PartialResolution struct {
	RefundMinor     int64
	SellerMinor     int64
	CommissionMinor int64
}

func SplitPartialResolution(amountMinor, refundMinor, commissionBps int64) (PartialResolution, error) {
	if refundMinor <= 0 || refundMinor >= amountMinor {
		return PartialResolution{}, httpserver.NewApiError(http.StatusUnprocessableEntity, "INVALID_PARTIAL_REFUND", "A partial refund must be more than zero and less than the order total.")
	}
	split, err := SplitAmountBetweenSellerAndPlatform(amountMinor-refundMinor, commissionBps)
	if err != nil {
		return PartialResolution{}, err
	}
	return PartialResolution{RefundMinor: refundMinor, SellerMinor: split.SellerAmountMinor, CommissionMinor: split.CommissionMinor}, nil
}

func CommissionKeptOnRemainder(heldCommissionMinor, amountMinor, remainderMinor int64) int64 {
	if amountMinor <= 0 || heldCommissionMinor <= 0 || remainderMinor <= 0 {
		return 0
	}
	remainderMinor = min(remainderMinor, amountMinor)
	kept := new(big.Int).Mul(big.NewInt(heldCommissionMinor), big.NewInt(remainderMinor))
	return kept.Quo(kept, big.NewInt(amountMinor)).Int64()
}
