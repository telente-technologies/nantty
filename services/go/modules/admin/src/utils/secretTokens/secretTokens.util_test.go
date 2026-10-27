package secrettokens

import (
	"slices"
	"testing"
)

func TestStaffPasswordPolicyListsEveryProblem(t *testing.T) {
	cases := []struct {
		name     string
		password string
		want     []string
	}{
		{"strong passphrase passes", "Quartz-Lantern-81", nil},
		{"too short", "Ab1!", []string{"Use 12-128 characters."}},
		{"no upper case", "quartz-lantern-81", []string{"Mix upper and lower case letters."}},
		{"no digit", "Quartz-Lantern-xy", []string{"Include a number."}},
		{"no symbol", "QuartzLantern81x", []string{"Include a symbol."}},
		{"uses the name", "Adaeze-Lantern-81", []string{"Do not use your name or email in the password."}},
		{"uses the email local part", "Opsdesk-Lantern-81", []string{"Do not use your name or email in the password."}},
		{"repeats a character", "Quartz-Laaaaantern-81", []string{"Avoid repeating the same character."}},
	}
	for _, testCase := range cases {
		problems := FindStaffPasswordProblems(testCase.password, "opsdesk@nantty.com", "Adaeze Obi")
		if len(problems) != len(testCase.want) {
			t.Errorf("%s: got %v, want %v", testCase.name, problems, testCase.want)
			continue
		}
		for _, wanted := range testCase.want {
			if !slices.Contains(problems, wanted) {
				t.Errorf("%s: missing %q in %v", testCase.name, wanted, problems)
			}
		}
	}
	if AssertStaffPasswordMeetsPolicy("weak", "a@b.co", "") == nil {
		t.Fatal("weak passwords are rejected")
	}
	if problems := FindStaffPasswordProblems("Quartz-Obi-Lantern-81", "x@nantty.com", "Obi Ada"); len(problems) != 0 {
		t.Fatal("name parts shorter than four characters are ignored")
	}
}
