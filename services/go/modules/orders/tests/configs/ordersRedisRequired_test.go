package configs_test

import (
	"strings"
	"testing"

	"nantty/modules/orders/src/configs"
	platformconfig "nantty/platform/config"
)

func TestProductionRequiresTheOrdersIdempotencyRedis(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("ORDERS_DATABASE_URL", "postgres://orders")
	t.Setenv("ORDERS_MONEY_GRPC_ADDRESS", "money:9000")
	t.Setenv("ORDERS_MONEY_GRPC_TOKEN", strings.Repeat("t", 40))
	t.Setenv("ORDERS_REDIS_URL", "")
	reader := platformconfig.NewEnvironmentReader()
	configs.ReadOrdersSettingsFromEnvironment(reader)
	err := reader.CombinedConfigurationError()
	if err == nil || !strings.Contains(err.Error(), "ORDERS_REDIS_URL") {
		t.Fatalf("production without ORDERS_REDIS_URL must fail configuration, got %v", err)
	}
	t.Setenv("ORDERS_REDIS_URL", "redis://cache:6379")
	reader = platformconfig.NewEnvironmentReader()
	if settings := configs.ReadOrdersSettingsFromEnvironment(reader); settings.RedisUrl == "" || reader.CombinedConfigurationError() != nil {
		t.Fatalf("configured production settings rejected: %v", reader.CombinedConfigurationError())
	}
}

func TestLogisticsContactIsConfiguredSeparatelyFromCustomerContacts(t *testing.T) {
	t.Setenv("APP_ENV", "test")
	t.Setenv("ORDERS_DATABASE_URL", "postgres://orders")
	t.Setenv("LOGISTICS_ENABLED", "true")
	t.Setenv("LOGISTICS_CONTACT_EMAIL", "natty-logistics@example.test")
	reader := platformconfig.NewEnvironmentReader()
	settings := configs.ReadOrdersSettingsFromEnvironment(reader)
	if settings.LogisticsContactEmail != "natty-logistics@example.test" {
		t.Fatalf("Natty logistics contact must come only from its dedicated setting: %q", settings.LogisticsContactEmail)
	}
	if reader.CombinedConfigurationError() != nil {
		t.Fatalf("test configuration rejected: %v", reader.CombinedConfigurationError())
	}
}
