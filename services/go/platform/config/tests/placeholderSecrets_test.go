package config_test

import (
	"encoding/base64"
	. "nantty/platform/config"
	"strings"
	"testing"
)

func TestRejectPlaceholderSecretsReportsLocalAndExampleValues(t *testing.T) {
	reader := NewEnvironmentReader()
	reader.RejectPlaceholderSecrets([]string{
		"MONEY_INTERNAL_GRPC_TOKEN=local-only-money-internal-grpc-token-0123",
		"AUTH_ONE_TIME_CODE_PEPPER=" + base64.StdEncoding.EncodeToString([]byte("local-only-one-time-code-pepper-")),
		"AWS_SECRET_ACCESS_KEY=test",
		"LIVEKIT_API_KEY=devkey",
		"AUTH_OTP_EVENT_KEY_ID=otp-1",
		"FLUTTERWAVE_SECRET_KEY=FLWSECK-realistic-value-0123456789-X",
		"APP_ENV=production",
	})
	err := reader.CombinedConfigurationError()
	if err == nil {
		t.Fatal("placeholder secrets must be reported")
	}
	for _, name := range []string{"MONEY_INTERNAL_GRPC_TOKEN", "AUTH_ONE_TIME_CODE_PEPPER", "AWS_SECRET_ACCESS_KEY", "LIVEKIT_API_KEY"} {
		if !strings.Contains(err.Error(), name) {
			t.Fatalf("%s should be reported: %v", name, err)
		}
	}
	for _, name := range []string{"AUTH_OTP_EVENT_KEY_ID", "FLUTTERWAVE_SECRET_KEY", "APP_ENV"} {
		if strings.Contains(err.Error(), name+" ") {
			t.Fatalf("%s should not be reported: %v", name, err)
		}
	}
}

func TestRejectPlaceholderSecretsAcceptsRealValues(t *testing.T) {
	reader := NewEnvironmentReader()
	reader.RejectPlaceholderSecrets([]string{"USERS_INTERNAL_API_TOKEN=9f2c1a7e5b3d4c6a8e0f1b2d3c4a5e6f7a8b9c0d", "EMPTY_TOKEN="})
	if err := reader.CombinedConfigurationError(); err != nil {
		t.Fatalf("real values must pass: %v", err)
	}
}
