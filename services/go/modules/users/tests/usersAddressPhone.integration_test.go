package users_test

import (
	"bytes"
	"context"
	"net/http"
	"testing"

	"nantty/modules/users/src/generated/ent/shippingaddress"
	addressservices "nantty/modules/users/src/modules/addresses/services"
)

func TestShippingAddressPhonesAreEncryptedAtRest(t *testing.T) {
	harness := startUsersModuleAgainstFreshSchema(t)
	accountId, token := harness.newAccount("address.owner", "Address Owner")
	var ghanaId string
	for _, country := range harness.expect("GET", "/api/v1/geo/countries", "", nil, http.StatusOK)["data"].([]any) {
		if country.(map[string]any)["code"] == "GH" {
			ghanaId = country.(map[string]any)["id"].(string)
		}
	}
	region := harness.expect("GET", "/api/v1/geo/countries/"+ghanaId+"/regions", "", nil, http.StatusOK)["data"].([]any)[0].(map[string]any)["id"].(string)
	body := map[string]any{"fullName": "Kofi Mensah", "phone": "+233 24 123 4567", "line1": "1 Ring Road", "postalCode": "", "details": "", "isDefault": true,
		"countryId": ghanaId, "stateId": region, "lgaId": nil, "cityId": nil}
	created := harness.expect("POST", "/api/v1/users/me/addresses", token, body, http.StatusCreated)
	if created["phone"] != "+233241234567" {
		t.Fatalf("the owner reads the phone back: %v", created)
	}
	client := harness.module.Container().Client
	ctx := context.Background()
	stored := client.ShippingAddress.Query().Where(shippingaddress.AccountID(mustParseUuid(accountId))).OnlyX(ctx)
	if stored.Phone != "" || stored.PhoneSealed == nil || bytes.Contains(*stored.PhoneSealed, []byte("1234567")) {
		t.Fatalf("the phone is sealed in the database: %q %v", stored.Phone, stored.PhoneSealed)
	}
	updated := harness.expect("PATCH", "/api/v1/users/me/addresses/"+created["id"].(string), token, map[string]any{"phone": "+233 20 000 0001"}, http.StatusOK)
	if updated["phone"] != "+233200000001" {
		t.Fatalf("an updated phone is readable: %v", updated)
	}
	harness.execSql("UPDATE shipping_addresses SET phone = '+233209999999', phone_sealed = NULL")
	if err := addressservices.SealPlaintextPhones(ctx, client, harness.module.Container().Settings.AddressPhoneKey); err != nil {
		t.Fatal(err)
	}
	if backfilled := client.ShippingAddress.Query().OnlyX(ctx); backfilled.Phone != "" || backfilled.PhoneSealed == nil {
		t.Fatalf("legacy plaintext phones are sealed by the backfill: %+v", backfilled)
	}
	listed := harness.expect("GET", "/api/v1/users/me/addresses/"+created["id"].(string), token, nil, http.StatusOK)
	if listed["phone"] != "+233209999999" {
		t.Fatalf("a backfilled phone still reads back: %v", listed)
	}
}
