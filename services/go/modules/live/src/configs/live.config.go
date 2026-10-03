package configs

import (
	"time"

	platformconfig "zudomart/platform/config"
)

type LiveSettings struct {
	Environment                     string
	DatabaseUrl                     string
	DatabaseSchema                  string
	DomainEventsTopicArn            string
	AccessTokenJwksUrl              string
	TokenIssuer                     string
	TokenAudience                   string
	RedisUrl                        string
	LiveKitUrl                      string
	LiveKitPublicUrl                string
	LiveKitApiKey                   string
	LiveKitApiSecret                string
	MediaTokenTimeToLive            time.Duration
	MoneyGrpcAddress                string
	AccountDirectoryGrpcAddress     string
	TimerPollInterval               time.Duration
	GuestRequiresMediaConfirmation  bool
	RequireCreatorProgramToHost     bool
	LiveAdTermsCurrentVersion       string
	GiftPlatformBurstLimitPerSecond int
}

func (settings LiveSettings) IsProduction() bool { return settings.Environment == "production" }

func ReadLiveSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) LiveSettings {
	settings := LiveSettings{
		Environment:                     reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:                     reader.ReadRequiredString("LIVE_DATABASE_URL"),
		DatabaseSchema:                  reader.ReadStringOrDefault("LIVE_DATABASE_SCHEMA", "live"),
		DomainEventsTopicArn:            reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		AccessTokenJwksUrl:              reader.ReadStringOrDefault("AUTH_JWKS_URL", "http://localhost:8101/.well-known/jwks.json"),
		TokenIssuer:                     reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.zudomart.com"),
		TokenAudience:                   reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "zudomart-api"),
		RedisUrl:                        reader.ReadStringOrDefault("LIVE_REDIS_URL", ""),
		LiveKitUrl:                      reader.ReadStringOrDefault("LIVEKIT_URL", "http://localhost:7880"),
		LiveKitPublicUrl:                reader.ReadStringOrDefault("LIVEKIT_PUBLIC_URL", "ws://localhost:7880"),
		LiveKitApiKey:                   reader.ReadStringOrDefault("LIVEKIT_API_KEY", "devkey"),
		LiveKitApiSecret:                reader.ReadRequiredString("LIVEKIT_API_SECRET"),
		MediaTokenTimeToLive:            reader.ReadDurationOrDefault("LIVE_MEDIA_TOKEN_TTL", 10*time.Minute),
		MoneyGrpcAddress:                reader.ReadStringOrDefault("LIVE_MONEY_GRPC_ADDRESS", ""),
		AccountDirectoryGrpcAddress:     reader.ReadStringOrDefault("LIVE_ACCOUNT_DIRECTORY_GRPC_ADDRESS", ""),
		TimerPollInterval:               reader.ReadDurationOrDefault("LIVE_TIMER_POLL_INTERVAL", time.Second),
		GuestRequiresMediaConfirmation:  reader.ReadStringOrDefault("LIVE_GUEST_REQUIRES_MEDIA_CONFIRMATION", "false") == "true",
		RequireCreatorProgramToHost:     reader.ReadStringOrDefault("LIVE_REQUIRE_CREATOR_PROGRAM_TO_HOST", "true") == "true",
		LiveAdTermsCurrentVersion:       reader.ReadStringOrDefault("LIVE_AD_TERMS_VERSION", "2026-10"),
		GiftPlatformBurstLimitPerSecond: reader.ReadIntegerOrDefault("LIVE_GIFT_BURST_LIMIT_PER_SECOND", 10),
	}
	if settings.IsProduction() && (settings.MoneyGrpcAddress == "" || settings.AccountDirectoryGrpcAddress == "") {
		reader.ReadRequiredString("LIVE_MONEY_AND_ACCOUNT_DIRECTORY_GRPC_ADDRESSES_REQUIRED_IN_PRODUCTION")
	}
	return settings
}
