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
	MoneyGrpcToken                  string
	AccountDirectoryGrpcToken       string
	MoneyCallTimeout                time.Duration
	AccountDirectoryCallTimeout     time.Duration
	GrpcRetryAttempts               int
	GrpcRetryBackoff                time.Duration
	AllowInMemoryMoneyFake          bool
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
		MoneyGrpcToken:                  reader.ReadStringOrDefault("LIVE_MONEY_GRPC_TOKEN", ""),
		AccountDirectoryGrpcToken:       reader.ReadStringOrDefault("LIVE_ACCOUNT_DIRECTORY_GRPC_TOKEN", ""),
		MoneyCallTimeout:                reader.ReadDurationOrDefault("LIVE_MONEY_CALL_TIMEOUT", 5*time.Second),
		AccountDirectoryCallTimeout:     reader.ReadDurationOrDefault("LIVE_ACCOUNT_DIRECTORY_CALL_TIMEOUT", 2*time.Second),
		GrpcRetryAttempts:               reader.ReadIntegerOrDefault("LIVE_GRPC_RETRY_ATTEMPTS", 3),
		GrpcRetryBackoff:                reader.ReadDurationOrDefault("LIVE_GRPC_RETRY_BACKOFF", 100*time.Millisecond),
		TimerPollInterval:               reader.ReadDurationOrDefault("LIVE_TIMER_POLL_INTERVAL", time.Second),
		GuestRequiresMediaConfirmation:  reader.ReadStringOrDefault("LIVE_GUEST_REQUIRES_MEDIA_CONFIRMATION", "false") == "true",
		RequireCreatorProgramToHost:     reader.ReadStringOrDefault("LIVE_REQUIRE_CREATOR_PROGRAM_TO_HOST", "true") == "true",
		LiveAdTermsCurrentVersion:       reader.ReadStringOrDefault("LIVE_AD_TERMS_VERSION", "2026-10"),
		GiftPlatformBurstLimitPerSecond: reader.ReadIntegerOrDefault("LIVE_GIFT_BURST_LIMIT_PER_SECOND", 10),
	}
	settings.AllowInMemoryMoneyFake = !settings.IsProduction()
	if settings.IsProduction() {
		settings.MoneyGrpcAddress = reader.ReadRequiredString("LIVE_MONEY_GRPC_ADDRESS")
		settings.AccountDirectoryGrpcAddress = reader.ReadRequiredString("LIVE_ACCOUNT_DIRECTORY_GRPC_ADDRESS")
		if len(settings.MoneyGrpcToken) < 32 {
			reader.ReadRequiredString("LIVE_MONEY_GRPC_TOKEN_OF_AT_LEAST_32_CHARACTERS")
		}
		if len(settings.AccountDirectoryGrpcToken) < 32 {
			reader.ReadRequiredString("LIVE_ACCOUNT_DIRECTORY_GRPC_TOKEN_OF_AT_LEAST_32_CHARACTERS")
		}
	}
	return settings
}
