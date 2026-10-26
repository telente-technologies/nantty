package configs

import (
	"time"

	platformconfig "nantty/platform/config"
)

type InventorySettings struct {
	Environment             string
	DatabaseUrl             string
	DatabaseSchema          string
	DomainEventsTopicArn    string
	AccessTokenJwksUrl      string
	TokenIssuer             string
	TokenAudience           string
	RedisUrl                string
	ReservationSweepPeriod  time.Duration
	ReservationSweepBatch   int
	MaximumAdjustmentLines  int
	MaximumAdjustmentAmount int
}

func (settings InventorySettings) IsProduction() bool { return settings.Environment == "production" }

func ReadInventorySettingsFromEnvironment(reader *platformconfig.EnvironmentReader) InventorySettings {
	settings := InventorySettings{
		Environment:             reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:             reader.ReadRequiredString("INVENTORY_DATABASE_URL"),
		DatabaseSchema:          reader.ReadStringOrDefault("INVENTORY_DATABASE_SCHEMA", "inventory"),
		DomainEventsTopicArn:    reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		AccessTokenJwksUrl:      reader.ReadStringOrDefault("AUTH_JWKS_URL", "http://localhost:8101/.well-known/jwks.json"),
		TokenIssuer:             reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.zudomart.com"),
		TokenAudience:           reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "zudomart-api"),
		RedisUrl:                reader.ReadStringOrDefault("INVENTORY_REDIS_URL", ""),
		ReservationSweepPeriod:  reader.ReadDurationOrDefault("INVENTORY_RESERVATION_SWEEP_INTERVAL", 30*time.Second),
		ReservationSweepBatch:   reader.ReadIntegerOrDefault("INVENTORY_RESERVATION_SWEEP_BATCH", 100),
		MaximumAdjustmentLines:  200,
		MaximumAdjustmentAmount: 1_000_000,
	}
	if settings.IsProduction() {
		settings.RedisUrl = reader.ReadRequiredString("INVENTORY_REDIS_URL")
	}
	return settings
}
