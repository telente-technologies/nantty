package retention_test

import (
	"testing"

	"nantty/modules/users/src/modules/retention/dtos"
	"nantty/modules/users/src/modules/retention/validators"
)

func TestValidateUpdateRetentionPolicyRequest(t *testing.T) {
	yes, days, tooMany, negative := true, 90, 40000, -1
	cases := []struct {
		name    string
		request dtos.UpdateRetentionPolicyRequest
		valid   bool
	}{
		{"valid", dtos.UpdateRetentionPolicyRequest{Action: "anonymize", RetentionDays: &days, NeedsLegalReview: &yes, ExpectedVersion: 1, Reason: "legal advice 2026-10"}, true},
		{"no period configured", dtos.UpdateRetentionPolicyRequest{Action: "retain", NeedsLegalReview: &yes, ExpectedVersion: 2, Reason: "keep as is"}, true},
		{"unknown action", dtos.UpdateRetentionPolicyRequest{Action: "shred", NeedsLegalReview: &yes, ExpectedVersion: 1, Reason: "because"}, false},
		{"missing legal flag", dtos.UpdateRetentionPolicyRequest{Action: "delete", ExpectedVersion: 1, Reason: "because"}, false},
		{"short reason", dtos.UpdateRetentionPolicyRequest{Action: "delete", NeedsLegalReview: &yes, ExpectedVersion: 1, Reason: "no"}, false},
		{"no version", dtos.UpdateRetentionPolicyRequest{Action: "delete", NeedsLegalReview: &yes, Reason: "because"}, false},
		{"period too large", dtos.UpdateRetentionPolicyRequest{Action: "delete", RetentionDays: &tooMany, NeedsLegalReview: &yes, ExpectedVersion: 1, Reason: "because"}, false},
		{"negative period", dtos.UpdateRetentionPolicyRequest{Action: "delete", RetentionDays: &negative, NeedsLegalReview: &yes, ExpectedVersion: 1, Reason: "because"}, false},
	}
	for _, testCase := range cases {
		if err := validators.ValidateUpdateRetentionPolicyRequest(testCase.request); (err == nil) != testCase.valid {
			t.Errorf("%s: %v", testCase.name, err)
		}
	}
	if validators.ValidateCategory("orders") != nil || validators.ValidateCategory("pets") == nil {
		t.Fatal("category validation is wrong")
	}
}
