package validators

import (
	"testing"

	"zudomart/modules/admin/src/modules/staffAuth/dtos"
)

func TestChallengeCodeRequestValidation(t *testing.T) {
	token := "0123456789012345678901234567890123456789"
	cases := []struct {
		name    string
		request dtos.ChallengeCodeRequest
		valid   bool
	}{
		{"valid", dtos.ChallengeCodeRequest{ChallengeToken: token, Code: "123456"}, true},
		{"short code", dtos.ChallengeCodeRequest{ChallengeToken: token, Code: "12345"}, false},
		{"letters", dtos.ChallengeCodeRequest{ChallengeToken: token, Code: "12345a"}, false},
		{"short token", dtos.ChallengeCodeRequest{ChallengeToken: "abc", Code: "123456"}, false},
	}
	for _, testCase := range cases {
		if (ValidateChallengeCodeRequest(testCase.request) == nil) != testCase.valid {
			t.Errorf("%s: unexpected result", testCase.name)
		}
	}
}
