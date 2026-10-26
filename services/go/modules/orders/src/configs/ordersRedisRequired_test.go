package configs

import (
	"strings"
	"testing"

	platformconfig "nantty/platform/config"
)

func TestProductionRequiresTheOrdersIdempotencyRedis(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("ORDERS_DATABASE_URL", "postgres://orders")
	t.Setenv("ORDERS_MONEY_GRPC_ADDRESS", "money:9000")
	t.Setenv("ORDERS_MONEY_GRPC_TOKEN", strings.Repeat("t", 40))
	t.Setenv("ORDERS_REDIS_URL", "")
	reader := platformconfig.NewEnvironmentReader()
	ReadOrdersSettingsFromEnvironment(reader)
	err := reader.CombinedConfigurationError()
	if err == nil || !strings.Contains(err.Error(), "ORDERS_REDIS_URL") {
		t.Fatalf("production without ORDERS_REDIS_URL must fail configuration, got %v", err)
	}
	t.Setenv("ORDERS_REDIS_URL", "redis://cache:6379")
	reader = platformconfig.NewEnvironmentReader()
	if settings := ReadOrdersSettingsFromEnvironment(reader); settings.RedisUrl == "" || reader.CombinedConfigurationError() != nil {
		t.Fatalf("configured production settings rejected: %v", reader.CombinedConfigurationError())
	}
}
