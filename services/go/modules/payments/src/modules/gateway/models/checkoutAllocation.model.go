package models

import (
	"encoding/json"
	"errors"
	"math"
	"math/big"
	"sort"
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

func EstimateLocalCheckoutFee(amountMinor int64) int64 {
	if amountMinor <= 0 {
		return 0
	}
	return min((amountMinor*140+5_000)/10_000, 200_000)
}

func AllocateProRata(totalMinor int64, weights []int64) []int64 {
	parts := make([]int64, len(weights))
	sum := new(big.Int)
	for _, weight := range weights {
		sum.Add(sum, big.NewInt(max(weight, 0)))
	}
	if sum.Sign() == 0 || totalMinor <= 0 {
		return parts
	}
	remainders := make([]*big.Int, len(weights))
	allocated := int64(0)
	for index, weight := range weights {
		quotient, remainder := new(big.Int).QuoRem(new(big.Int).Mul(big.NewInt(totalMinor), big.NewInt(max(weight, 0))), sum, new(big.Int))
		parts[index], remainders[index] = quotient.Int64(), remainder
		allocated += parts[index]
	}
	order := make([]int, 0, len(weights))
	for index, weight := range weights {
		if weight > 0 {
			order = append(order, index)
		}
	}
	sort.SliceStable(order, func(left, right int) bool { return remainders[order[left]].Cmp(remainders[order[right]]) > 0 })
	for position := 0; allocated < totalMinor; position = (position + 1) % len(order) {
		parts[order[position]]++
		allocated++
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
		if total > math.MaxInt64-group.AmountMinor {
			return nil, errors.New("the checkout total is too large")
		}
		weights[index], total = group.AmountMinor, total+group.AmountMinor
	}
	fees := AllocateProRata(EstimateLocalCheckoutFee(total), weights)
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
