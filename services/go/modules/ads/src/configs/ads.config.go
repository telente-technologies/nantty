package configs

import (
	"strings"
	"time"

	platformconfig "zudomart/platform/config"
)

type AdsSettings struct {
	Environment            string
	DatabaseUrl            string
	DatabaseSchema         string
	UsersSchema            string
	DomainEventsTopicArn   string
	AccessTokenJwksUrl     string
	TokenIssuer            string
	TokenAudience          string
	StaffJwksUrl           string
	StaffTokenIssuer       string
	RedisUrl               string
	AdTokenKeys            map[string]string
	AdTokenActiveKeyId     string
	AdTokenTimeToLive      time.Duration
	InternalSharedSecret   string
	IntelligenceUrl        string
	IntelligenceSecret     string
	IntelligenceTimeout    time.Duration
	MediaBaseUrl           string
	EnabledPlacements      []string
	CandidateRefresh       time.Duration
	SettlementInterval     time.Duration
	RetentionInterval      time.Duration
	RawImpressionRetention time.Duration
	PacingBurstBps         int64
	PacingUpfrontBps       int64
	MinimumPrerollSeconds  int
	SkipAfterSeconds       int
	ReservePerMilleMinor   map[string]int64
	AutoBidMultiple        int64
	BaselineCtrPpm         int64
	AllowInMemoryFunding   bool
	BoostMinimumDailyMinor map[string]int64
}

func (settings AdsSettings) IsProduction() bool { return settings.Environment == "production" }

func ReadAdsSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) AdsSettings {
	settings := AdsSettings{
		Environment:            reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:            reader.ReadRequiredString("ADS_DATABASE_URL"),
		DatabaseSchema:         reader.ReadStringOrDefault("ADS_DATABASE_SCHEMA", "ads"),
		UsersSchema:            reader.ReadStringOrDefault("USERS_DATABASE_SCHEMA", "users"),
		DomainEventsTopicArn:   reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		AccessTokenJwksUrl:     reader.ReadStringOrDefault("AUTH_JWKS_URL", "http://localhost:8101/.well-known/jwks.json"),
		TokenIssuer:            reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.zudomart.com"),
		TokenAudience:          reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "zudomart-api"),
		StaffJwksUrl:           reader.ReadStringOrDefault("ADS_STAFF_JWKS_URL", "http://localhost:8103/.well-known/staff-jwks.json"),
		StaffTokenIssuer:       reader.ReadStringOrDefault("ADS_STAFF_TOKEN_ISSUER", "https://admin.zudomart.com"),
		RedisUrl:               reader.ReadStringOrDefault("ADS_REDIS_URL", ""),
		AdTokenActiveKeyId:     reader.ReadStringOrDefault("ADS_TOKEN_ACTIVE_KEY_ID", "k1"),
		AdTokenTimeToLive:      reader.ReadDurationOrDefault("ADS_TOKEN_TTL", 24*time.Hour),
		IntelligenceUrl:        reader.ReadStringOrDefault("INTELLIGENCE_URL", ""),
		IntelligenceSecret:     reader.ReadStringOrDefault("INTELLIGENCE_SHARED_SECRET", ""),
		IntelligenceTimeout:    reader.ReadDurationOrDefault("ADS_INTELLIGENCE_TIMEOUT", 30*time.Millisecond),
		MediaBaseUrl:           reader.ReadStringOrDefault("ADS_MEDIA_URL", "https://cdn.zudomart.com/media"),
		EnabledPlacements:      reader.ReadCommaSeparatedListOrDefault("ADS_ENABLED_PLACEMENTS", []string{"feed", "clips", "mart", "search"}),
		CandidateRefresh:       reader.ReadDurationOrDefault("ADS_CANDIDATE_REFRESH", 10*time.Second),
		SettlementInterval:     reader.ReadDurationOrDefault("ADS_SETTLEMENT_INTERVAL", time.Minute),
		RetentionInterval:      reader.ReadDurationOrDefault("ADS_RETENTION_INTERVAL", time.Hour),
		RawImpressionRetention: reader.ReadDurationOrDefault("ADS_RAW_IMPRESSION_RETENTION", 14*24*time.Hour),
		PacingBurstBps:         int64(reader.ReadIntegerOrDefault("ADS_PACING_BURST_BPS", 12000)),
		PacingUpfrontBps:       int64(reader.ReadIntegerOrDefault("ADS_PACING_UPFRONT_BPS", 200)),
		MinimumPrerollSeconds:  reader.ReadIntegerOrDefault("ADS_MIN_PREROLL_CONTENT_SECONDS", 120),
		SkipAfterSeconds:       reader.ReadIntegerOrDefault("ADS_SKIP_AFTER_SECONDS", 5),
		AutoBidMultiple:        int64(reader.ReadIntegerOrDefault("ADS_AUTO_BID_MULTIPLE", 2)),
		BaselineCtrPpm:         int64(reader.ReadIntegerOrDefault("ADS_BASELINE_CTR_PPM", 15000)),
		ReservePerMilleMinor:   map[string]int64{"NGN": 50_000, "GHS": 750, "KES": 7_500, "ZAR": 1_500, "GBP": 75, "EUR": 75, "USD": 75},
		BoostMinimumDailyMinor: map[string]int64{"NGN": 100_000, "GHS": 1_000, "KES": 10_000, "ZAR": 2_000, "GBP": 100, "EUR": 100, "USD": 100},
	}
	settings.AdTokenKeys = readAdTokenKeys(reader, settings.AdTokenActiveKeyId, settings.IsProduction())
	settings.InternalSharedSecret = reader.ReadStringOrDefault("ADS_INTERNAL_SHARED_SECRET", "")
	settings.AllowInMemoryFunding = !settings.IsProduction()
	if settings.IsProduction() {
		reader.RequireMinimumLength("ADS_INTERNAL_SHARED_SECRET", settings.InternalSharedSecret, 32)
		settings.RedisUrl = reader.ReadRequiredString("ADS_REDIS_URL")
	}
	return settings
}

func readAdTokenKeys(reader *platformconfig.EnvironmentReader, activeKeyId string, production bool) map[string]string {
	keys := map[string]string{}
	for _, entry := range reader.ReadCommaSeparatedListOrDefault("ADS_TOKEN_KEYS", nil) {
		id, secret, found := strings.Cut(entry, ":")
		if found && id != "" {
			keys[id] = secret
		}
	}
	if len(keys) == 0 && production {
		reader.ReadRequiredString("ADS_TOKEN_KEYS")
	}
	if len(keys) == 0 {
		keys[activeKeyId] = reader.ReadStringOrDefault("ADS_TOKEN_SECRET", "development-only-ad-token-secret-change")
	}
	for id, secret := range keys {
		reader.RequireMinimumLength("ADS_TOKEN_KEYS["+id+"]", secret, 32)
	}
	return keys
}
