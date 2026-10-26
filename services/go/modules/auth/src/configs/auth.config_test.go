package configs

import (
	"strings"
	"testing"

	platformconfig "nantty/platform/config"
)

func otpDeliveryProblem(t *testing.T, environment, mode string) bool {
	t.Setenv("APP_ENV", environment)
	t.Setenv("AUTH_OTP_DELIVERY", mode)
	reader := platformconfig.NewEnvironmentReader()
	ReadAuthSettingsFromEnvironment(reader)
	err := reader.CombinedConfigurationError()
	return err != nil && strings.Contains(err.Error(), "AUTH_OTP_DELIVERY")
}

func TestUnknownOtpDeliveryModeIsRefusedSoCodesNeverFallBackToLogs(t *testing.T) {
	for _, mode := range []string{"email", "Event", "sqs", ""} {
		if !otpDeliveryProblem(t, "production", mode) {
			t.Fatalf("AUTH_OTP_DELIVERY=%q must be refused", mode)
		}
	}
	if !otpDeliveryProblem(t, "production", "log") {
		t.Fatal("log delivery must be refused in production")
	}
	if otpDeliveryProblem(t, "development", "log") || otpDeliveryProblem(t, "production", "event") {
		t.Fatal("log in development and event anywhere must be accepted")
	}
}

func TestOtpSendCapMustBePositive(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("AUTH_OTP_DELIVERY", "log")
	t.Setenv("AUTH_OTP_MAX_SENDS_PER_HOUR", "0")
	reader := platformconfig.NewEnvironmentReader()
	ReadAuthSettingsFromEnvironment(reader)
	if err := reader.CombinedConfigurationError(); err == nil || !strings.Contains(err.Error(), "AUTH_OTP_MAX_SENDS_PER_HOUR") {
		t.Fatalf("want a positive send-cap requirement, got %v", err)
	}
}
