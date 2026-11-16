package utils_test

import (
	"testing"

	"nantty/modules/payments/src/utils"
)

func TestNamesMatchToleratesOrderCaseAndSmallTypos(t *testing.T) {
	cases := []struct {
		left, right string
		matches     bool
	}{
		{"Temitope Adeyemi", "ADEYEMI TEMITOPE", true},
		{"Temitope Adeyemi", "ADEYEMI TEMITOPE OLUWASEUN", true},
		{"Temitope Adeyemi", "Temitop Adeyemi", true},
		{"Temitope Adeyemi", "Chukwuemeka Obi", false},
		{"Temitope Adeyemi", "", false},
		{"Ade", "Adeyemi Temitope", false},
	}
	for _, testCase := range cases {
		if got := utils.NamesMatch(testCase.left, testCase.right); got != testCase.matches {
			t.Errorf("NamesMatch(%q, %q) = %v (score %.3f), want %v", testCase.left, testCase.right, got, utils.NameSimilarity(testCase.left, testCase.right), testCase.matches)
		}
	}
}
