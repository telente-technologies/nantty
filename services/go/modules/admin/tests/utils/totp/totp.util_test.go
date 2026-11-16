package totp_test

import (
	"strings"
	"testing"
	"time"

	"nantty/modules/admin/src/utils/totp"
)

func TestComputeCodeMatchesRfc6238Vectors(t *testing.T) {
	secret := []byte("12345678901234567890")
	cases := []struct {
		unixSeconds int64
		want        string
	}{
		{59, "94287082"}, {1111111109, "07081804"}, {1111111111, "14050471"},
		{1234567890, "89005924"}, {2000000000, "69279037"}, {20000000000, "65353130"},
	}
	for _, testCase := range cases {
		if got := totp.ComputeCode(secret, testCase.unixSeconds/totp.StepSeconds, 8); got != testCase.want {
			t.Errorf("t=%d got %s want %s", testCase.unixSeconds, got, testCase.want)
		}
	}
}

func TestVerifyAcceptsDriftRejectsReplayAndOutOfWindowCodes(t *testing.T) {
	secret := []byte("12345678901234567890")
	now := time.Unix(1_700_000_000, 0)
	step := totp.StepAt(now)
	cases := []struct {
		name         string
		code         string
		lastUsedStep int64
		wantOk       bool
		wantStep     int64
	}{
		{"current step", totp.ComputeCode(secret, step, 6), 0, true, step},
		{"previous step", totp.ComputeCode(secret, step-1, 6), 0, true, step - 1},
		{"next step", totp.ComputeCode(secret, step+1, 6), 0, true, step + 1},
		{"two steps old", totp.ComputeCode(secret, step-2, 6), 0, false, 0},
		{"replay of used step", totp.ComputeCode(secret, step, 6), step, false, 0},
		{"older than used step", totp.ComputeCode(secret, step-1, 6), step, false, 0},
		{"wrong length", "12345", 0, false, 0},
		{"not digits", "abcdef", 0, false, 0},
	}
	for _, testCase := range cases {
		gotStep, ok := totp.VerifyCodeRejectingReplays(secret, testCase.code, now, testCase.lastUsedStep)
		if ok != testCase.wantOk || gotStep != testCase.wantStep {
			t.Errorf("%s: got %d %v", testCase.name, gotStep, ok)
		}
	}
}

func TestProvisioningUriCarriesTheEncodedSecret(t *testing.T) {
	secret, err := totp.GenerateSecret()
	if err != nil || len(secret) != totp.SecretBytes {
		t.Fatalf("secret: %v", err)
	}
	uri := totp.BuildProvisioningUri("Nantty", "ada@nantty.com", secret)
	if !strings.HasPrefix(uri, "otpauth://totp/Nantty:ada@nantty.com?") && !strings.HasPrefix(uri, "otpauth://totp/Nantty%3Aada@nantty.com?") {
		t.Fatalf("unexpected uri %s", uri)
	}
	if !strings.Contains(uri, "secret="+totp.EncodeSecretForAuthenticatorApps(secret)) {
		t.Fatal("secret missing")
	}
}
