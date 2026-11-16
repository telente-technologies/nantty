package services_test

import (
	"testing"

	"nantty/modules/users/src/modules/geo/services"
)

func TestEmbeddedSeedDataHasExpectedNigeriaStructure(t *testing.T) {
	countries, err := services.ReadEmbeddedSeedCountries()
	if err != nil {
		t.Fatal(err)
	}
	byCode := map[string]int{}
	for index, country := range countries {
		byCode[country.Code] = index
	}
	nigeria := countries[byCode["NG"]]
	if len(nigeria.Regions) != 37 || nigeria.RegionLabel == nil || *nigeria.RegionLabel != "State" || nigeria.AdminAreaLabel == nil || *nigeria.AdminAreaLabel != "LGA" {
		t.Fatalf("nigeria needs 36 states + FCT with State/LGA labels, got %d regions", len(nigeria.Regions))
	}
	totalAreas := 0
	for _, region := range nigeria.Regions {
		totalAreas += len(region.Areas)
		known := map[string]bool{}
		for _, area := range region.Areas {
			if known[area] {
				t.Errorf("%s repeats LGA %s", region.Name, area)
			}
			known[area] = true
		}
		for _, city := range region.Cities {
			if city.Area != "" && !known[city.Area] {
				t.Errorf("city %s points at unknown LGA %s", city.Name, city.Area)
			}
		}
	}
	if totalAreas != 774 {
		t.Fatalf("Nigeria has 774 LGAs including the 6 FCT area councils, seed has %d", totalAreas)
	}
}

func TestOtherSupportedCountriesAreSeededAtRegionLevelOnly(t *testing.T) {
	countries, _ := services.ReadEmbeddedSeedCountries()
	want := map[string]int{"GH": 16, "KE": 47, "ZA": 9, "GB": 4, "US": 51, "DE": 16, "FR": 13, "IE": 26, "NL": 12, "ES": 17, "IT": 20}
	for _, country := range countries {
		if country.Code == "NG" {
			continue
		}
		if len(country.Regions) != want[country.Code] || country.AdminAreaLabel != nil {
			t.Errorf("%s: %d regions, admin label %v", country.Code, len(country.Regions), country.AdminAreaLabel)
		}
		for _, region := range country.Regions {
			if len(region.Areas) != 0 {
				t.Errorf("%s/%s must not carry areas", country.Code, region.Name)
			}
		}
		delete(want, country.Code)
	}
	if len(want) != 0 {
		t.Fatalf("missing countries: %v", want)
	}
}
