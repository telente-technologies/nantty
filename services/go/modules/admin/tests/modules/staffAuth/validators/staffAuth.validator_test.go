package validators_test

import (
	"testing"

	"nantty/modules/admin/src/modules/staffAuth/dtos"
	"nantty/modules/admin/src/modules/staffAuth/validators"
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
		{"recovery code without method", dtos.ChallengeCodeRequest{ChallengeToken: token, Code: "ABCDE-12345"}, true},
		{"explicit recovery method", dtos.ChallengeCodeRequest{ChallengeToken: token, Method: "recovery", Code: "abcde12345"}, true},
		{"passkey response", dtos.ChallengeCodeRequest{ChallengeToken: token, Method: "webauthn", Credential: []byte(`{"id":"abc"}`)}, true},
		{"passkey without response", dtos.ChallengeCodeRequest{ChallengeToken: token, Method: "webauthn"}, false},
		{"unknown method", dtos.ChallengeCodeRequest{ChallengeToken: token, Method: "sms", Code: "123456"}, false},
	}
	for _, testCase := range cases {
		if (validators.ValidateChallengeCodeRequest(testCase.request) == nil) != testCase.valid {
			t.Errorf("%s: unexpected result", testCase.name)
		}
	}
}

func TestStepUpAcceptsTotpOrPasskeyButNeverRecoveryCodes(t *testing.T) {
	if validators.ValidateStepUpRequest(dtos.StepUpRequest{Code: "123456"}) != nil {
		t.Fatal("totp step-up is valid")
	}
	if validators.ValidateStepUpRequest(dtos.StepUpRequest{Method: "webauthn", Credential: []byte(`{"id":"abc"}`)}) != nil {
		t.Fatal("passkey step-up is valid")
	}
	if validators.ValidateStepUpRequest(dtos.StepUpRequest{Code: "ABCDE-12345"}) == nil || validators.ValidateStepUpRequest(dtos.StepUpRequest{Method: "recovery", Code: "ABCDE-12345"}) == nil {
		t.Fatal("recovery codes cannot step up")
	}
}
