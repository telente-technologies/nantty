package privacy_test

import (
	"fmt"
	"net/http"
	"testing"
)

func findByName(t *testing.T, items []map[string]any, name string) map[string]any {
	t.Helper()
	for _, item := range items {
		if item["name"] == name {
			return item
		}
	}
	t.Fatalf("%q not found among %d items", name, len(items))
	return nil
}

type geoIds struct{ country, state, lga, city string }

func lookUpNigeriaIds(t *testing.T, harness *privacyHarness, stateName, lgaName string) geoIds {
	t.Helper()
	countries := listItems(t, harness.expect("GET", "/api/v1/geo/countries", "", nil, http.StatusOK))
	country := findByName(t, countries, "Nigeria")
	states := listItems(t, harness.expect("GET", "/api/v1/geo/countries/"+country["id"].(string)+"/regions", "", nil, http.StatusOK))
	state := findByName(t, states, stateName)
	areas := listItems(t, harness.expect("GET", "/api/v1/geo/regions/"+state["id"].(string)+"/admin-areas", "", nil, http.StatusOK))
	area := findByName(t, areas, lgaName)
	return geoIds{country: country["id"].(string), state: state["id"].(string), lga: area["id"].(string)}
}

func TestGeoReferenceDataIsServedPerCountryStructure(t *testing.T) {
	harness := startPrivacyHarness(t)
	countries := listItems(t, harness.expect("GET", "/api/v1/geo/countries", "", nil, http.StatusOK))
	if len(countries) != 12 {
		t.Fatalf("want 12 supported countries, got %d", len(countries))
	}
	nigeria := findByName(t, countries, "Nigeria")
	if nigeria["code"] != "NG" || nigeria["currency"] != "NGN" || nigeria["stateLabel"] != "State" || nigeria["lgaLabel"] != "LGA" {
		t.Fatalf("unexpected Nigeria %v", nigeria)
	}
	if levels := nigeria["levels"].([]any); len(levels) != 3 || levels[0] != "state" || levels[1] != "lga" || levels[2] != "city" {
		t.Fatalf("Nigeria has states, LGAs and cities: %v", levels)
	}
	ghana := findByName(t, countries, "Ghana")
	if levels := ghana["levels"].([]any); len(levels) != 1 || levels[0] != "state" {
		t.Fatalf("Ghana is region-level only: %v", levels)
	}

	_, headers := func() (int, http.Header) {
		_, _, h := harness.send("GET", "/api/v1/geo/countries", "", nil, nil)
		return 200, h
	}()
	if headers.Get("Cache-Control") == "" || headers.Get("Cache-Control") == "no-store" {
		t.Fatalf("geo data must be cacheable, got %q", headers.Get("Cache-Control"))
	}

	ids := lookUpNigeriaIds(t, harness, "Lagos", "Ikeja")
	lagosAreas := listItems(t, harness.expect("GET", "/api/v1/geo/regions/"+ids.state+"/admin-areas", "", nil, http.StatusOK))
	if len(lagosAreas) != 20 {
		t.Fatalf("Lagos has 20 LGAs, got %d", len(lagosAreas))
	}
	cities := listItems(t, harness.expect("GET", "/api/v1/geo/admin-areas/"+ids.lga+"/cities", "", nil, http.StatusOK))
	findByName(t, cities, "Ikeja")
	stateCities := listItems(t, harness.expect("GET", "/api/v1/geo/regions/"+ids.state+"/cities", "", nil, http.StatusOK))
	if len(stateCities) < len(cities) {
		t.Fatal("state-level city list must include the area cities")
	}
	ghanaRegions := listItems(t, harness.expect("GET", "/api/v1/geo/countries/GH/regions", "", nil, http.StatusOK))
	if len(ghanaRegions) != 16 {
		t.Fatalf("Ghana has 16 regions, got %d", len(ghanaRegions))
	}
	harness.expect("GET", "/api/v1/geo/countries/ZZ/regions", "", nil, http.StatusNotFound)
	harness.expect("GET", "/api/v1/geo/regions/not-a-uuid/admin-areas", "", nil, http.StatusNotFound)
}

func addressBody(ids geoIds, overrides map[string]any) map[string]any {
	body := map[string]any{"fullName": "Temitope Adeyemi", "phone": "+234 803 441 7720", "line1": "14 Awolowo Avenue", "postalCode": "100001", "details": "Blue gate", "isDefault": false, "countryId": ids.country, "stateId": ids.state, "lgaId": ids.lga, "cityId": nil}
	for key, value := range overrides {
		body[key] = value
	}
	return body
}

func TestAddressBookValidatesGeoStructureDefaultsAndOwnership(t *testing.T) {
	harness := startPrivacyHarness(t)
	_, ada := harness.newAccount("ada")
	_, grace := harness.newAccount("grace")
	lagos := lookUpNigeriaIds(t, harness, "Lagos", "Ikeja")
	oyo := lookUpNigeriaIds(t, harness, "Oyo", "Ibadan North")

	harness.expect("GET", "/api/v1/users/me/addresses", "", nil, http.StatusUnauthorized)
	first := harness.expect("POST", "/api/v1/users/me/addresses", ada, addressBody(lagos, nil), http.StatusCreated)
	if first["isDefault"] != true || first["phone"] != "+2348034417720" || first["state"] != "Lagos" || first["lga"] != "Ikeja" || first["country"] != "Nigeria" || first["countryCode"] != "NG" {
		t.Fatalf("first address must be the default with resolved names: %v", first)
	}
	if display, _ := first["display"].(string); display == "" {
		t.Fatalf("display block missing: %v", first)
	}
	second := harness.expect("POST", "/api/v1/users/me/addresses", ada, addressBody(oyo, map[string]any{"isDefault": true, "line1": "9 Ogunlana Drive"}), http.StatusCreated)
	listed := listItems(t, harness.expect("GET", "/api/v1/users/me/addresses", ada, nil, http.StatusOK))
	defaults := 0
	for _, item := range listed {
		if item["isDefault"] == true {
			defaults++
		}
	}
	if len(listed) != 2 || defaults != 1 || listed[0]["id"] != second["id"] {
		t.Fatalf("exactly one default, the newest default first: %v", listed)
	}

	rejected := []struct {
		name string
		body map[string]any
	}{
		{"lga from another state", addressBody(lagos, map[string]any{"lgaId": oyo.lga})},
		{"missing lga where the region has areas", addressBody(lagos, map[string]any{"lgaId": nil})},
		{"missing state", addressBody(lagos, map[string]any{"stateId": nil})},
		{"bad phone", addressBody(lagos, map[string]any{"phone": "0803"})},
		{"bad postal code", addressBody(lagos, map[string]any{"postalCode": "12"})},
		{"unknown country", addressBody(lagos, map[string]any{"countryId": "zz"})},
		{"unknown field", addressBody(lagos, map[string]any{"shippingZone": "A"})},
		{"short recipient", addressBody(lagos, map[string]any{"fullName": "A"})},
	}
	for _, testCase := range rejected {
		status, body, _ := harness.send("POST", "/api/v1/users/me/addresses", ada, nil, testCase.body)
		if status != http.StatusBadRequest {
			t.Errorf("%s: status %d %v, want 400", testCase.name, status, body)
		}
	}

	ghana := listItems(t, harness.expect("GET", "/api/v1/geo/countries/GH/regions", "", nil, http.StatusOK))
	ghanaBody := map[string]any{"fullName": "Kofi Mensah", "phone": "+233 24 123 4567", "line1": "5 Oxford Street", "countryId": "GH", "stateId": ghana[0]["id"]}
	created := harness.expect("POST", "/api/v1/users/me/addresses", grace, ghanaBody, http.StatusCreated)
	if created["lgaId"] != nil || created["country"] != "Ghana" {
		t.Fatalf("Ghana address has no LGA: %v", created)
	}
	ghanaBody["lgaId"] = lagos.lga
	harness.expect("POST", "/api/v1/users/me/addresses", grace, ghanaBody, http.StatusBadRequest)

	firstId := first["id"].(string)
	harness.expect("GET", "/api/v1/users/me/addresses/"+firstId, grace, nil, http.StatusNotFound)
	harness.expect("PATCH", "/api/v1/users/me/addresses/"+firstId, grace, map[string]any{"line1": "Hijacked street"}, http.StatusNotFound)
	harness.expect("DELETE", "/api/v1/users/me/addresses/"+firstId, grace, nil, http.StatusNotFound)

	patched := harness.expect("PATCH", "/api/v1/users/me/addresses/"+firstId, ada, map[string]any{"line1": "20 New Road", "countryId": oyo.country, "stateId": oyo.state, "lgaId": oyo.lga}, http.StatusOK)
	if patched["line1"] != "20 New Road" || patched["state"] != "Oyo" || patched["lga"] != "Ibadan North" {
		t.Fatalf("patch must move the address: %v", patched)
	}
	harness.expect("PATCH", "/api/v1/users/me/addresses/"+firstId, ada, map[string]any{"stateId": lagos.state}, http.StatusBadRequest)
	promoted := harness.expect("PATCH", "/api/v1/users/me/addresses/"+firstId, ada, map[string]any{"isDefault": true}, http.StatusOK)
	if promoted["isDefault"] != true {
		t.Fatalf("setting the default must stick: %v", promoted)
	}

	harness.expect("DELETE", "/api/v1/users/me/addresses/"+firstId, ada, nil, http.StatusNoContent)
	remaining := listItems(t, harness.expect("GET", "/api/v1/users/me/addresses", ada, nil, http.StatusOK))
	if len(remaining) != 1 || remaining[0]["isDefault"] != true {
		t.Fatalf("deleting the default must promote another address: %v", remaining)
	}
	harness.expect("GET", "/api/v1/users/me/addresses/"+firstId, ada, nil, http.StatusNotFound)
}

func TestAddressBookIsLimitedToTwentyEntries(t *testing.T) {
	harness := startPrivacyHarness(t)
	_, token := harness.newAccount("hoarder")
	lagos := lookUpNigeriaIds(t, harness, "Lagos", "Ikeja")
	for index := 1; index <= 20; index++ {
		harness.expect("POST", "/api/v1/users/me/addresses", token, addressBody(lagos, map[string]any{"line1": fmt.Sprintf("%d Market Road", index)}), http.StatusCreated)
	}
	limited := harness.expect("POST", "/api/v1/users/me/addresses", token, addressBody(lagos, nil), http.StatusConflict)
	if limited["code"] != "ADDRESS_LIMIT_REACHED" {
		t.Fatalf("unexpected %v", limited)
	}
}
