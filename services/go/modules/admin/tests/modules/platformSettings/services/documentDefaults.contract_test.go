package services_test

import (
	"encoding/json"
	"testing"

	"nantty/modules/admin/src/modules/platformSettings/models"
	"nantty/modules/admin/src/modules/platformSettings/services"
)

func TestDocumentDefaultsMirrorWhatMoneyAndUsersEnforceToday(t *testing.T) {
	revenue := services.PlatformSettingDefinitions[services.RevenueRulesKey].DefaultValue.(services.RevenueRulesConfiguration)
	if revenue.CoinTransferFeeBasisPoints != 200 || revenue.CreatorAdShareBasisPoints != 4000 || revenue.EscrowFee.DefaultBasisPoints != 0 || revenue.EscrowFee.BusinessPlanBasisPoints != 0 {
		t.Fatalf("revenue defaults drifted from COIN_TRANSFER_FEE_BPS, ADS_REVENUE_CREATOR_SHARE_BPS or zero platform sales commission: %+v", revenue)
	}
	if len(revenue.CoinUnitValues) != 7 || revenue.CoinUnitValues[0] != (services.MoneyValue{AmountMinor: 1000, Currency: "NGN"}) {
		t.Fatalf("coin unit values must equal COIN_CASH_VALUES: %v", revenue.CoinUnitValues)
	}
	usernames := services.PlatformSettingDefinitions[services.UsernameRulesKey].DefaultValue.(services.UsernameRules)
	if usernames.ReleasedUsernameCooldownDays != 120 || usernames.ChangeWindowDays != 30 || usernames.MinimumLength != 3 || usernames.MaximumLength != 30 || usernames.MustStartWithLetter {
		t.Fatalf("username defaults drifted from the users module: %+v", usernames)
	}
	for key, value := range map[string]any{services.RevenueRulesKey: revenue, services.UsernameRulesKey: usernames} {
		raw, _ := json.Marshal(value)
		if _, err := services.PlatformSettingDefinitions[key].Validate(raw); err != nil {
			t.Errorf("%s default must validate: %v", key, err)
		}
	}
	thresholds, err := json.Marshal(services.PlatformSettingDefinitions[services.CreatorThresholdsKey].DefaultValue)
	if err != nil {
		t.Fatal(err)
	}
	projected, err := services.ProjectSettingView(services.CreatorEligibilityKey, models.PlatformSettingView{Key: services.CreatorThresholdsKey, Value: thresholds})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := services.PlatformSettingDefinitions[services.CreatorEligibilityKey].Validate(projected.Value); err != nil {
		t.Errorf("projected creator eligibility default must validate: %v", err)
	}
}
