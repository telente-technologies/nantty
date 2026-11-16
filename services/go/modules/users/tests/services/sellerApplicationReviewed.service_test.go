package services_test

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"testing"

	"nantty/modules/users/src/services"
	platformevents "nantty/platform/events"
	"nantty/platform/identityports"
	"nantty/platform/identityports/identitytest"
)

func TestApprovedSellerApplicationsGrantTheSellerRoleOnce(t *testing.T) {
	directory := identitytest.NewFakeAccountDirectory()
	identityports.Default.RegisterAccountEnforcement(directory)
	approved := directory.AddAccount("new.seller", "New Seller")
	rejected := directory.AddAccount("not.yet", "Not Yet")
	message := func(accountId, decision string) json.RawMessage {
		encoded, _ := json.Marshal(map[string]string{"applicationId": "app-1", "accountId": accountId, "decision": decision, "reason": "checked"})
		return encoded
	}
	for range 2 {
		if err := services.GrantSellerRoleOnApproval(context.Background(), message(approved.ID.String(), "approved")); err != nil {
			t.Fatal(err)
		}
	}
	if err := services.GrantSellerRoleOnApproval(context.Background(), message(rejected.ID.String(), "rejected")); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	seller, _, _ := directory.FindAccountSummary(ctx, approved.ID)
	other, _, _ := directory.FindAccountSummary(ctx, rejected.ID)
	sellerRoles := 0
	for _, role := range seller.Roles {
		if role == "seller" {
			sellerRoles++
		}
	}
	if sellerRoles != 1 || slices.Contains(other.Roles, "seller") {
		t.Fatalf("approval grants seller exactly once and rejection grants nothing: %v %v", seller.Roles, other.Roles)
	}
	if err := services.GrantSellerRoleOnApproval(ctx, json.RawMessage(`{"accountId":"nope","decision":"approved"}`)); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("a bad account id is a poison message: %v", err)
	}
}
