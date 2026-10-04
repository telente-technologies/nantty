package configs

import (
	"strconv"
	"strings"
	"time"

	platformconfig "zudomart/platform/config"
)

type AdsSettings struct {
	Environment            string
	DatabaseUrl            string
	DatabaseSchema         string
	UsersSchema            string
	AdminSchema            string
	CurrencySchema         string
	PlatformSettingsTtl    time.Duration
	CreatorShareBps        int64
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
	PublicBaseUrl          string
	IdentityInternalUrl    string
	IdentityInternalToken  string
	BlockedDomains         []string
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
	PopulationByCountry    map[string]int64
	AssetsBucket           string
	S3Endpoint             string
	ReportQueueName        string
	ContentSourcesUrl      string
	ContentSourcesToken    string
	CommerceInternalUrl    string
	CommerceInternalToken  string
	UploadUrlLifetime      time.Duration
	ReportLinkLifetime     time.Duration
	ReportSweepInterval    time.Duration
	MoneyGrpcAddress       string
	MoneyInternalToken     string
	MoneyHttpUrl           string
}

func (settings AdsSettings) IsProduction() bool { return settings.Environment == "production" }

func ReadAdsSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) AdsSettings {
	settings := AdsSettings{
		Environment:            reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:            reader.ReadRequiredString("ADS_DATABASE_URL"),
		DatabaseSchema:         reader.ReadStringOrDefault("ADS_DATABASE_SCHEMA", "ads"),
		UsersSchema:            reader.ReadStringOrDefault("USERS_DATABASE_SCHEMA", "users"),
		AdminSchema:            reader.ReadStringOrDefault("ADMIN_DATABASE_SCHEMA", "admin"),
		CurrencySchema:         reader.ReadStringOrDefault("CURRENCY_DATABASE_SCHEMA", "currency"),
		PlatformSettingsTtl:    reader.ReadDurationOrDefault("ADS_PLATFORM_SETTINGS_TTL", 30*time.Second),
		CreatorShareBps:        int64(reader.ReadIntegerOrDefault("ADS_CREATOR_SHARE_BPS", 4000)),
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
		IntelligenceTimeout:    reader.ReadDurationOrDefault("ADS_INTELLIGENCE_TIMEOUT", 80*time.Millisecond),
		MediaBaseUrl:           reader.ReadStringOrDefault("ADS_MEDIA_URL", "https://cdn.zudomart.com/media"),
		PublicBaseUrl:          reader.ReadStringOrDefault("ADS_PUBLIC_URL", "https://api.zudomart.com"),
		IdentityInternalUrl:    reader.ReadStringOrDefault("IDENTITY_INTERNAL_URL", ""),
		IdentityInternalToken:  reader.ReadStringOrDefault("IDENTITY_INTERNAL_TOKEN", ""),
		BlockedDomains:         reader.ReadCommaSeparatedListOrDefault("ADS_BLOCKED_DOMAINS", []string{}),
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
		PopulationByCountry:    readPopulation(reader),
		AssetsBucket:           reader.ReadStringOrDefault("ADS_ASSETS_BUCKET", ""),
		S3Endpoint:             reader.ReadStringOrDefault("ADS_S3_ENDPOINT_URL", ""),
		ReportQueueName:        reader.ReadStringOrDefault("ADS_REPORT_QUEUE_NAME", ""),
		ContentSourcesUrl:      reader.ReadStringOrDefault("SOCIAL_INTERNAL_URL", ""),
		ContentSourcesToken:    reader.ReadStringOrDefault("SOCIAL_INTERNAL_TOKEN", ""),
		CommerceInternalUrl:    reader.ReadStringOrDefault("COMMERCE_INTERNAL_URL", ""),
		CommerceInternalToken:  reader.ReadStringOrDefault("COMMERCE_INTERNAL_TOKEN", ""),
		UploadUrlLifetime:      reader.ReadDurationOrDefault("ADS_UPLOAD_URL_TTL", 30*time.Minute),
		ReportLinkLifetime:     reader.ReadDurationOrDefault("ADS_REPORT_LINK_TTL", 7*24*time.Hour),
		ReportSweepInterval:    reader.ReadDurationOrDefault("ADS_REPORT_SWEEP_INTERVAL", time.Minute),
		BoostMinimumDailyMinor: map[string]int64{"NGN": 100_000, "GHS": 1_000, "KES": 10_000, "ZAR": 2_000, "GBP": 100, "EUR": 100, "USD": 100},
	}
	settings.AdTokenKeys = readAdTokenKeys(reader, settings.AdTokenActiveKeyId, settings.IsProduction())
	settings.InternalSharedSecret = reader.ReadStringOrDefault("ADS_INTERNAL_SHARED_SECRET", "")
	settings.MoneyGrpcAddress = reader.ReadStringOrDefault("ADS_MONEY_GRPC_ADDRESS", "")
	settings.MoneyInternalToken = reader.ReadStringOrDefault("ADS_MONEY_INTERNAL_TOKEN", "")
	settings.MoneyHttpUrl = reader.ReadStringOrDefault("ADS_MONEY_HTTP_URL", "")
	settings.AllowInMemoryFunding = !settings.IsProduction()
	if settings.IsProduction() {
		settings.AssetsBucket = reader.ReadRequiredString("ADS_ASSETS_BUCKET")
		settings.ReportQueueName = reader.ReadRequiredString("ADS_REPORT_QUEUE_NAME")
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

func readPopulation(reader *platformconfig.EnvironmentReader) map[string]int64 {
	population := map[string]int64{"NG": 9_000_000, "GH": 1_500_000, "KE": 2_000_000, "ZA": 2_500_000, "GB": 1_000_000, "US": 1_000_000}
	for _, entry := range reader.ReadCommaSeparatedListOrDefault("ADS_POPULATION_BY_COUNTRY", nil) {
		country, count, found := strings.Cut(entry, ":")
		if parsed, err := strconv.ParseInt(count, 10, 64); found && err == nil && parsed >= 0 {
			population[strings.ToUpper(country)] = parsed
		}
	}
	return population
}
