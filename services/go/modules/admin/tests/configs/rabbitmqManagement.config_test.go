package configs_test

import (
	"testing"

	"nantty/modules/admin/src/configs"
	platformconfig "nantty/platform/config"
)

func newAdminSettingsReader(t *testing.T) *platformconfig.EnvironmentReader {
	t.Helper()
	t.Setenv("ADMIN_DATABASE_URL", "postgres://nantty:local@localhost/nantty")
	t.Setenv("ADMIN_INTERNAL_API_TOKEN", "test-internal-token-that-is-long-enough")
	t.Setenv("ADMIN_TOTP_ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
	return platformconfig.NewEnvironmentReader()
}

func TestRabbitMQManagementMonitoringIsOptionalWhenUnset(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("RABBITMQ_MANAGEMENT_URL", "")
	t.Setenv("RABBITMQ_MONITORING_USERNAME", "")
	t.Setenv("RABBITMQ_MONITORING_PASSWORD", "")
	reader := newAdminSettingsReader(t)
	settings := configs.ReadAdminSettingsFromEnvironment(reader)
	if err := reader.CombinedConfigurationError(); err != nil {
		t.Fatal(err)
	}
	if settings.RabbitMQManagement.URL != "" || settings.RabbitMQManagement.Vhost != "nantty" {
		t.Fatalf("unexpected defaults: %+v", settings.RabbitMQManagement)
	}
}

func TestRabbitMQManagementRequiresDedicatedCredentials(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("RABBITMQ_MANAGEMENT_URL", "https://broker.example")
	t.Setenv("RABBITMQ_MONITORING_USERNAME", "monitor")
	t.Setenv("RABBITMQ_MONITORING_PASSWORD", "")
	reader := newAdminSettingsReader(t)
	_ = configs.ReadAdminSettingsFromEnvironment(reader)
	if err := reader.CombinedConfigurationError(); err == nil {
		t.Fatal("expected incomplete monitoring credentials to be rejected")
	}
}

func TestRabbitMQManagementRequiresHttpsInProduction(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("RABBITMQ_MANAGEMENT_URL", "http://broker.example")
	t.Setenv("RABBITMQ_MONITORING_USERNAME", "monitor")
	t.Setenv("RABBITMQ_MONITORING_PASSWORD", "synthetic-test-secret")
	t.Setenv("ADMIN_INVITATION_DELIVERY", "email")
	t.Setenv("ADMIN_INVITATION_DELIVERY_NOT_LOG_IN_PRODUCTION", "configured")
	reader := newAdminSettingsReader(t)
	_ = configs.ReadAdminSettingsFromEnvironment(reader)
	if err := reader.CombinedConfigurationError(); err == nil {
		t.Fatal("expected production HTTP management URL to be rejected")
	}
}
