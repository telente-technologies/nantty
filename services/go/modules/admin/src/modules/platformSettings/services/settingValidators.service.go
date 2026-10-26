package services

import (
	"bytes"
	"encoding/json"
	"fmt"

	adminerrors "nantty/modules/admin/src/errors"
	"nantty/platform/regionpricing"
)

func decodeStrictly[Value any](raw json.RawMessage, destination *Value) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return adminerrors.Unprocessable("The value does not match this setting: " + err.Error())
	}
	if decoder.More() {
		return adminerrors.Unprocessable("The value has trailing data.")
	}
	return nil
}

func requireWithin(name string, value, minimum, maximum int) error {
	if value < minimum || value > maximum {
		return adminerrors.Unprocessable(fmt.Sprintf("%s must be between %d and %d.", name, minimum, maximum))
	}
	return nil
}

func canonicalJson(value any) (json.RawMessage, error) {
	return json.Marshal(value)
}

func validateCreatorRequirements(raw json.RawMessage) (json.RawMessage, error) {
	var value CreatorRequirements
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	for _, check := range []error{
		requireWithin("minimumFollowers", value.MinimumFollowers, 0, 10_000_000),
		requireWithin("minimumAccountAgeDays", value.MinimumAccountAgeDays, 0, 3650),
		requireWithin("minimumOriginalPosts", value.MinimumOriginalPosts, 0, 100_000),
		requireWithin("maximumRecentStrikes", value.MaximumRecentStrikes, 0, 100),
		requireWithin("strikeLookbackDays", value.StrikeLookbackDays, 1, 3650),
	} {
		if check != nil {
			return nil, check
		}
	}
	return canonicalJson(value)
}

func validateMonetizationPolicy(raw json.RawMessage) (json.RawMessage, error) {
	var value MonetizationPolicy
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if err := requireWithin("rows", len(value.Rows), 1, 50); err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	for _, row := range value.Rows {
		if !monetizationRowIdPattern.MatchString(row.Id) || seen[row.Id] {
			return nil, adminerrors.Unprocessable("Row ids must be unique, 2-40 lowercase letters, numbers or underscores.")
		}
		seen[row.Id] = true
		if err := requireWithin("label length", len(row.Label), 1, 80); err != nil {
			return nil, err
		}
		if err := requireWithin("multiplierBps", row.MultiplierBps, 0, 30000); err != nil {
			return nil, err
		}
	}
	return canonicalJson(value)
}

func validateGiftShareTiers(raw json.RawMessage) (json.RawMessage, error) {
	var value GiftShareTiers
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if err := requireWithin("tiers", len(value.Tiers), 1, 20); err != nil {
		return nil, err
	}
	if value.Tiers[0].MinimumMonthlyGiftCoins != 0 {
		return nil, adminerrors.Unprocessable("The first tier must start at 0 coins.")
	}
	for index, tier := range value.Tiers {
		if tier.CreatorShareBps < 0 || tier.CreatorShareBps > maximumCreatorShareBps {
			return nil, adminerrors.Unprocessable(fmt.Sprintf("creatorShareBps must be between 0 and %d.", maximumCreatorShareBps))
		}
		if index > 0 && tier.MinimumMonthlyGiftCoins <= value.Tiers[index-1].MinimumMonthlyGiftCoins {
			return nil, adminerrors.Unprocessable("Tier thresholds must be strictly ascending.")
		}
	}
	return canonicalJson(value)
}

func validateEscrowPolicy(raw json.RawMessage) (json.RawMessage, error) {
	var value EscrowPolicy
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	for _, check := range []error{
		requireWithin("autoReleaseDays", value.AutoReleaseDays, 1, 30),
		requireWithin("sellerCreditHoldHours", value.SellerCreditHoldHours, 0, 720),
		requireWithin("sellerReserveBps", value.SellerReserveBps, 0, 5000),
	} {
		if check != nil {
			return nil, check
		}
	}
	return canonicalJson(value)
}

func validateRegionalPricing(raw json.RawMessage) (json.RawMessage, error) {
	var value regionpricing.SettingDocument
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if err := regionpricing.ValidateSettingDocument(value); err != nil {
		return nil, adminerrors.Unprocessable(err.Error())
	}
	return canonicalJson(value)
}

func validateAppStoreFees(raw json.RawMessage) (json.RawMessage, error) {
	var value regionpricing.StoreFeeSettings
	if err := decodeStrictly(raw, &value); err != nil {
		return nil, err
	}
	if err := regionpricing.ValidateStoreFeeSettings(value); err != nil {
		return nil, adminerrors.Unprocessable(err.Error())
	}
	return canonicalJson(value)
}
