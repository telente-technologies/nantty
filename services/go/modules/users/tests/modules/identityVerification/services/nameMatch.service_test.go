package services_test

import (
	"testing"

	"nantty/modules/users/src/modules/identityVerification/services"
)

func TestNameMatchScores(t *testing.T) {
	cases := []struct {
		name         string
		document     string
		profiles     []string
		autoApproved bool
		mismatch     bool
	}{
		{"same name different order and case", "OBI AMAKA GRACE", []string{"Amaka Obi"}, true, false},
		{"diacritics and punctuation are ignored", "ADÉBAYỌ, Túndé", []string{"Adebayo Tunde"}, true, false},
		{"small spelling difference still matches", "Chukwuemeka Okafor", []string{"Chukwuemeka Okafo"}, true, false},
		{"one-word display name never auto-approves", "Amaka Grace Obi", []string{"Amaka"}, false, false},
		{"best of the profile names wins", "Tobi Adeyemi", []string{"Adire Studio", "Tobi Adeyemi"}, true, false},
		{"a different person is a mismatch", "Ibrahim Musa", []string{"Amaka Obi"}, false, true},
		{"an empty document name scores zero", "", []string{"Amaka Obi"}, false, true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			score := services.ScoreNameMatch(testCase.document, testCase.profiles...)
			if (score >= services.NameMatchAutoApproveThreshold) != testCase.autoApproved {
				t.Fatalf("score %.3f, auto-approve want %v", score, testCase.autoApproved)
			}
			if (score < services.NameMismatchFraudThreshold) != testCase.mismatch {
				t.Fatalf("score %.3f, mismatch want %v", score, testCase.mismatch)
			}
		})
	}
}
