package services_test

import (
	"testing"
	"time"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/userconsent"
	"nantty/modules/users/src/modules/consents/services"
)

func consentRow(status userconsent.Status, at time.Time) *ent.UserConsent {
	return &ent.UserConsent{Status: status, ConsentedAt: at, PolicyVersion: "1.0"}
}

func TestDeviceDecisionsWinOnlyWhenNewerAndDifferent(t *testing.T) {
	base := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	device := map[string]*ent.UserConsent{
		"analytics":       consentRow(userconsent.StatusGranted, base.Add(time.Hour)),
		"personalization": consentRow(userconsent.StatusGranted, base),
		"advertising":     consentRow(userconsent.StatusGranted, base.Add(time.Hour)),
		"marketing":       consentRow(userconsent.StatusWithdrawn, base.Add(2*time.Hour)),
	}
	account := map[string]*ent.UserConsent{
		"analytics":       consentRow(userconsent.StatusWithdrawn, base),
		"personalization": consentRow(userconsent.StatusWithdrawn, base.Add(time.Hour)),
		"advertising":     consentRow(userconsent.StatusGranted, base),
	}
	winners := services.ChooseDeviceDecisionsThatWinOverAccount(device, account)
	got := map[string]bool{}
	for _, winner := range winners {
		got[winner.Decision.ConsentType] = winner.Decision.Granted
	}
	want := map[string]bool{"analytics": true, "marketing": false}
	if len(got) != len(want) || got["analytics"] != true || got["marketing"] != false {
		t.Fatalf("winners %v, want %v (newer device decision wins, same state or older loses, undecided account takes device)", got, want)
	}
	if again := services.ChooseDeviceDecisionsThatWinOverAccount(nil, account); len(again) != 0 {
		t.Fatal("no device rows means nothing to merge")
	}
}
