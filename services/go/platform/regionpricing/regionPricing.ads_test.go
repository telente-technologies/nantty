package regionpricing

import "testing"

func TestAdFloorPerTargetedRegionInTheBillingCurrency(t *testing.T) {
	table := DefaultAdRegionPricing()
	nigeria, err := FloorsForTargetedRegions(table, []string{"NG"}, "NGN", DefaultUsdRatesE8)
	if err != nil || nigeria.CpmFloorMinor != 40_000 || nigeria.MinimumDailyBudgetMinor != 100_000 {
		t.Fatalf("NG in NGN %+v %v", nigeria, err)
	}
	ukInNaira, err := FloorsForTargetedRegions(table, []string{"GB"}, "NGN", DefaultUsdRatesE8)
	if err != nil || ukInNaira.CpmFloorMinor != 490_507 {
		t.Fatalf("GB floor billed in NGN %+v %v", ukInNaira, err)
	}
	nigeriaInDollars, err := FloorsForTargetedRegions(table, []string{"NG"}, "USD", DefaultUsdRatesE8)
	if err != nil || nigeriaInDollars.CpmFloorMinor != 26 {
		t.Fatalf("NG floor billed in USD %+v %v", nigeriaInDollars, err)
	}
	mixed, err := FloorsForTargetedRegions(table, RegionsForCountries([]string{"NG", "KE", "US"}), "USD", DefaultUsdRatesE8)
	if err != nil || mixed.CpmFloorMinor != 350 || mixed.Region != "MULTI" {
		t.Fatalf("multi-region takes the strictest floor %+v %v", mixed, err)
	}
	untargeted, _ := FloorsForTargetedRegions(table, nil, "USD", DefaultUsdRatesE8)
	if untargeted.CpmFloorMinor != 350 {
		t.Fatalf("no targeting uses the US fallback %+v", untargeted)
	}
	if _, err := FloorsForTargetedRegions(table, []string{"NG"}, "JPY", DefaultUsdRatesE8); err == nil {
		t.Fatal("an unknown billing currency must fail")
	}
}

func TestRegionsForCountriesGroupsEurozoneAndFallsBack(t *testing.T) {
	regions := RegionsForCountries([]string{"DE", "FR", "BR", "US", "NG"})
	if len(regions) != 3 || regions[0] != "EU" || regions[1] != "US" || regions[2] != "NG" {
		t.Fatalf("%v", regions)
	}
}

func TestConvertMinorUnitsRoundsDownForReporting(t *testing.T) {
	converted, err := ConvertMinorUnits(155_000, "NGN", "USD", DefaultUsdRatesE8)
	if err != nil || converted != 100 {
		t.Fatalf("%d %v", converted, err)
	}
}
