package configs

import (
	"testing"

	platformconfig "nantty/platform/config"
)

func TestRabbitMQManagementMonitoringIsOptionalWhenUnset(t *testing.T) {
	t.Setenv("RABBITMQ_MANAGEMENT_URL", "")
	t.Setenv("RABBITMQ_MONITORING_USERNAME", "")
	t.Setenv("RABBITMQ_MONITORING_PASSWORD", "")
	reader := platformconfig.NewEnvironmentReader()
	settings := readRabbitMQManagementSettings(reader, false)
	if err := reader.CombinedConfigurationError(); err != nil {
		t.Fatal(err)
	}
	if settings.URL != "" || settings.Vhost != "nantty" {
		t.Fatalf("unexpected defaults: %+v", settings)
	}
}

func TestRabbitMQManagementRequiresDedicatedCredentials(t *testing.T) {
	t.Setenv("RABBITMQ_MANAGEMENT_URL", "https://broker.example")
	t.Setenv("RABBITMQ_MONITORING_USERNAME", "monitor")
	t.Setenv("RABBITMQ_MONITORING_PASSWORD", "")
	reader := platformconfig.NewEnvironmentReader()
	_ = readRabbitMQManagementSettings(reader, true)
	if err := reader.CombinedConfigurationError(); err == nil {
		t.Fatal("expected incomplete monitoring credentials to be rejected")
	}
}

func TestRabbitMQManagementRequiresHttpsInProduction(t *testing.T) {
	t.Setenv("RABBITMQ_MANAGEMENT_URL", "http://broker.example")
	t.Setenv("RABBITMQ_MONITORING_USERNAME", "monitor")
	t.Setenv("RABBITMQ_MONITORING_PASSWORD", "synthetic-test-secret")
	reader := platformconfig.NewEnvironmentReader()
	_ = readRabbitMQManagementSettings(reader, true)
	if err := reader.CombinedConfigurationError(); err == nil {
		t.Fatal("expected production HTTP management URL to be rejected")
	}
}
