package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
	"time"

	"github.com/google/uuid"
	"nantty/platform/usersdirectory"
)

type shippingQuoteRevisionLine struct {
	ItemId         string `json:"itemId"`
	VariantId      string `json:"variantId"`
	Quantity       int    `json:"quantity"`
	UnitPriceMinor int64  `json:"unitPriceMinor"`
	Currency       string `json:"currency"`
}

type shippingQuoteRevisionGroup struct {
	StoreId               string                      `json:"storeId"`
	SubtotalMinor         int64                       `json:"subtotalMinor"`
	Currency              string                      `json:"currency"`
	Outcome               string                      `json:"outcome"`
	FeeMinor              int64                       `json:"feeMinor"`
	ProfileId             string                      `json:"profileId"`
	ZoneId                string                      `json:"zoneId"`
	RuleId                string                      `json:"ruleId"`
	ThresholdAppliedMinor *int64                      `json:"thresholdAppliedMinor"`
	FreeThresholdMinor    *int64                      `json:"freeThresholdMinor"`
	Lines                 []shippingQuoteRevisionLine `json:"lines"`
}

func revisionGroupFor(group SellerGroup, result ShippingResult, profile *ShippingProfileRules) shippingQuoteRevisionGroup {
	revision := shippingQuoteRevisionGroup{
		StoreId: group.StoreId.String(), SubtotalMinor: group.SubtotalMinor, Currency: string(group.Currency),
		Outcome: result.Outcome, FeeMinor: result.FeeMinor, ThresholdAppliedMinor: result.ThresholdAppliedMinor, Lines: make([]shippingQuoteRevisionLine, 0, len(group.Lines)),
	}
	if profile != nil {
		revision.FreeThresholdMinor = profile.FreeThresholdMinor
	}
	if result.ProfileId != nil {
		revision.ProfileId = result.ProfileId.String()
	}
	if result.ZoneId != nil {
		revision.ZoneId = result.ZoneId.String()
	}
	if result.RuleId != nil {
		revision.RuleId = result.RuleId.String()
	}
	for _, line := range group.Lines {
		revision.Lines = append(revision.Lines, shippingQuoteRevisionLine{
			ItemId: line.ItemId.String(), VariantId: line.Product.VariantId.String(), Quantity: line.Quantity,
			UnitPriceMinor: line.Product.UnitPrice.AmountMinor, Currency: string(line.Product.UnitPrice.Currency),
		})
	}
	sort.Slice(revision.Lines, func(i, j int) bool { return revision.Lines[i].ItemId < revision.Lines[j].ItemId })
	return revision
}

func shippingQuoteRevisionFor(address usersdirectory.ShippingAddress, groups []shippingQuoteRevisionGroup) string {
	sort.Slice(groups, func(i, j int) bool { return groups[i].StoreId < groups[j].StoreId })
	identifier := func(value *uuid.UUID) string {
		if value == nil {
			return ""
		}
		return value.String()
	}
	payload, err := json.Marshal(struct {
		AddressId        string                       `json:"addressId"`
		AddressUpdatedAt string                       `json:"addressUpdatedAt"`
		CountryCode      string                       `json:"countryCode"`
		RegionId         string                       `json:"regionId"`
		AdminAreaId      string                       `json:"adminAreaId"`
		CityId           string                       `json:"cityId"`
		Groups           []shippingQuoteRevisionGroup `json:"groups"`
	}{
		AddressId: address.Id.String(), AddressUpdatedAt: address.UpdatedAt.UTC().Format(time.RFC3339Nano), CountryCode: address.CountryCode,
		RegionId: identifier(address.RegionId), AdminAreaId: identifier(address.AdminAreaId), CityId: identifier(address.CityId), Groups: groups,
	})
	if err != nil {
		return ""
	}
	digest := sha256.Sum256(payload)
	return hex.EncodeToString(digest[:])
}
