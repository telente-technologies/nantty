package services_test

import (
	"testing"

	"nantty/modules/users/src/modules/legal/services"
)

func TestGenerateWhatChangedListsAddedAndRemovedLines(t *testing.T) {
	cases := []struct {
		name     string
		previous string
		next     string
		want     []string
	}{
		{"no change", "A\nB", "A\nB", []string{}},
		{"added line", "A", "A\n## New rule", []string{"Added: New rule"}},
		{"removed line", "A\nB", "A", []string{"Removed: B"}},
		{"blank lines ignored", "A\n\n", "A\n   \n", []string{}},
	}
	for _, testCase := range cases {
		got := services.GenerateWhatChanged(testCase.previous, testCase.next)
		if len(got) != len(testCase.want) {
			t.Fatalf("%s: got %v want %v", testCase.name, got, testCase.want)
		}
		for index := range got {
			if got[index] != testCase.want[index] {
				t.Fatalf("%s: got %v want %v", testCase.name, got, testCase.want)
			}
		}
	}
}
