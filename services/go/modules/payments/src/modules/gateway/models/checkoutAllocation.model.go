package models

import (
	"encoding/json"
	"errors"
)

const CheckoutGroupsMetadataKey = "checkoutGroups"

type CheckoutGroupAllocation struct {
	OrderId           string `json:"orderId"`
	PaymentMode       string `json:"paymentMode"`
	SellerUserId      string `json:"sellerUserId"`
	Subaccount        string `json:"subaccount,omitempty"`
	AmountMinor       int64  `json:"amountMinor"`
	EstimatedFeeMinor int64  `json:"estimatedFeeMinor"`
	ShareMinor        int64  `json:"shareMinor,omitempty"`
	EscrowFeeMinor    int64  `json:"escrowFeeMinor"`
}

type SettledGroupAllocation struct {
	CheckoutGroupAllocation
	ProviderFeeMinor   int64
	AppliedAmountMinor int64
}

func (group CheckoutGroupAllocation) IsDirect() bool { return group.PaymentMode == "direct" }

func EstimatePaystackLocalFee(amountMinor int64) int64 {
	if amountMinor <= 0 {
		return 0
	}
	fee := (amountMinor*150 + 5_000) / 10_000
	if amountMinor >= 250_000 {
		fee += 10_000
	}
	return min(fee, 200_000)
}

func AllocateProRata(totalMinor int64, weights []int64) []int64 {
	parts := make([]int64, len(weights))
	var sum int64
	for _, weight := range weights {
		sum += max(weight, 0)
	}
	if sum == 0 || totalMinor <= 0 {
		return parts
	}
	var allocated int64
	for index, weight := range weights {
		parts[index] = totalMinor * max(weight, 0) / sum
		allocated += parts[index]
	}
	for index := 0; allocated < totalMinor; index = (index + 1) % len(parts) {
		if weights[index] > 0 {
			parts[index]++
			allocated++
		}
	}
	return parts
}

func AllocateCheckoutGroups(groups []CheckoutGroupAllocation) ([]CheckoutGroupAllocation, error) {
	weights := make([]int64, len(groups))
	var total int64
	for index, group := range groups {
		if group.AmountMinor <= 0 {
			return nil, errors.New("every seller group needs a positive amount")
		}
		if group.IsDirect() && group.Subaccount == "" {
			return nil, errors.New("a direct group needs the seller's settlement subaccount")
		}
		weights[index], total = group.AmountMinor, total+group.AmountMinor
	}
	fees := AllocateProRata(EstimatePaystackLocalFee(total), weights)
	allocated := make([]CheckoutGroupAllocation, len(groups))
	for index, group := range groups {
		group.EstimatedFeeMinor = fees[index]
		if group.IsDirect() {
			group.ShareMinor, group.EscrowFeeMinor = group.AmountMinor-fees[index], 0
		}
		allocated[index] = group
	}
	return allocated, nil
}

func SettleCheckoutGroups(groups []CheckoutGroupAllocation, actualFeeMinor int64) []SettledGroupAllocation {
	var directFees int64
	escrowWeights := make([]int64, len(groups))
	for index, group := range groups {
		if group.IsDirect() {
			directFees += group.EstimatedFeeMinor
		} else {
			escrowWeights[index] = group.AmountMinor
		}
	}
	escrowFees := AllocateProRata(max(actualFeeMinor-directFees, 0), escrowWeights)
	settled := make([]SettledGroupAllocation, len(groups))
	for index, group := range groups {
		settled[index] = SettledGroupAllocation{CheckoutGroupAllocation: group, ProviderFeeMinor: escrowFees[index], AppliedAmountMinor: group.AmountMinor}
		if group.IsDirect() {
			settled[index].ProviderFeeMinor, settled[index].AppliedAmountMinor = group.EstimatedFeeMinor, group.ShareMinor
		}
	}
	return settled
}

func DecodeCheckoutGroups(metadata map[string]string) []CheckoutGroupAllocation {
	var groups []CheckoutGroupAllocation
	if raw := metadata[CheckoutGroupsMetadataKey]; raw != "" {
		_ = json.Unmarshal([]byte(raw), &groups)
	}
	return groups
}

func EncodeCheckoutGroups(groups []CheckoutGroupAllocation) string {
	encoded, _ := json.Marshal(groups)
	return string(encoded)
}
