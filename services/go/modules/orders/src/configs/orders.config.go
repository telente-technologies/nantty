package configs

import (
	"strings"
	"time"

	platformconfig "nantty/platform/config"
)

type OrdersSettings struct {
	Environment             string
	DatabaseUrl             string
	DatabaseSchema          string
	DatabaseOwnerRole       string
	DomainEventsTopicArn    string
	AccessTokenJwksUrl      string
	TokenIssuer             string
	TokenAudience           string
	RedisUrl                string
	MoneyGrpcAddress        string
	MoneyGrpcToken          string
	MoneyCallTimeout        time.Duration
	GrpcRetryAttempts       int
	GrpcRetryBackoff        time.Duration
	AllowInMemoryMoneyFake  bool
	CheckoutReservationTtl  time.Duration
	CheckoutSweepPeriod     time.Duration
	CreditExpirySweepPeriod time.Duration
	SuccessRateRollupPeriod time.Duration
	ReportExportSweepPeriod time.Duration
	EventsQueueName         string
	ShippingRuleLimit       int
	LogisticsEnabled        bool
	LogisticsContactEmail   string
	AutoCompleteGrace       time.Duration
	InternalApiToken        string
	MoneyInternalUrl        string
	MoneyInternalToken      string
	SocialInternalUrl       string
	SocialInternalToken     string
	AdsInternalUrl          string
	AdsInternalToken        string
	AdminInternalUrl        string
	AdminInternalToken      string
	CheckoutCurrencies      []string
}

func (settings OrdersSettings) IsProduction() bool { return settings.Environment == "production" }

func ReadOrdersSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) OrdersSettings {
	settings := OrdersSettings{
		Environment:             reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:             reader.ReadRequiredString("ORDERS_DATABASE_URL"),
		DatabaseSchema:          reader.ReadStringOrDefault("ORDERS_DATABASE_SCHEMA", "orders"),
		DatabaseOwnerRole:       reader.ReadStringOrDefault("ORDERS_DATABASE_OWNER_ROLE", ""),
		DomainEventsTopicArn:    reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		AccessTokenJwksUrl:      reader.ReadStringOrDefault("AUTH_JWKS_URL", "http://localhost:8101/.well-known/jwks.json"),
		TokenIssuer:             reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.nantty.com"),
		TokenAudience:           reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "nantty-api"),
		RedisUrl:                reader.ReadStringOrDefault("ORDERS_REDIS_URL", ""),
		MoneyGrpcAddress:        reader.ReadStringOrDefault("ORDERS_MONEY_GRPC_ADDRESS", ""),
		MoneyGrpcToken:          reader.ReadStringOrDefault("ORDERS_MONEY_GRPC_TOKEN", ""),
		MoneyCallTimeout:        reader.ReadDurationOrDefault("ORDERS_MONEY_CALL_TIMEOUT", 5*time.Second),
		GrpcRetryAttempts:       reader.ReadIntegerOrDefault("ORDERS_GRPC_RETRY_ATTEMPTS", 3),
		GrpcRetryBackoff:        reader.ReadDurationOrDefault("ORDERS_GRPC_RETRY_BACKOFF", 100*time.Millisecond),
		CheckoutReservationTtl:  reader.ReadDurationOrDefault("ORDERS_CHECKOUT_RESERVATION_TTL", 30*time.Minute),
		CheckoutSweepPeriod:     reader.ReadDurationOrDefault("ORDERS_CHECKOUT_SWEEP_INTERVAL", 30*time.Second),
		CreditExpirySweepPeriod: reader.ReadDurationOrDefault("ORDERS_CREDIT_EXPIRY_SWEEP_INTERVAL", time.Hour),
		SuccessRateRollupPeriod: reader.ReadDurationOrDefault("ORDERS_SUCCESS_RATE_ROLLUP_INTERVAL", 6*time.Hour),
		ReportExportSweepPeriod: reader.ReadDurationOrDefault("ORDERS_REPORT_EXPORT_SWEEP_INTERVAL", 5*time.Second),
		EventsQueueName:         reader.ReadStringOrDefault("ORDERS_EVENTS_QUEUE", ""),
		ShippingRuleLimit:       50,
		LogisticsEnabled:        strings.EqualFold(reader.ReadStringOrDefault("LOGISTICS_ENABLED", "false"), "true"),
		LogisticsContactEmail:   reader.ReadStringOrDefault("LOGISTICS_CONTACT_EMAIL", ""),
		InternalApiToken:        reader.ReadStringOrDefault("CATALOG_INTERNAL_API_TOKEN", ""),
		MoneyInternalUrl:        reader.ReadStringOrDefault("ORDERS_MONEY_INTERNAL_URL", ""),
		MoneyInternalToken:      reader.ReadStringOrDefault("MONEY_INTERNAL_API_TOKEN", ""),
		SocialInternalUrl:       reader.ReadStringOrDefault("ORDERS_SOCIAL_INTERNAL_URL", ""),
		SocialInternalToken:     reader.ReadStringOrDefault("ORDERS_SOCIAL_INTERNAL_TOKEN", ""),
		AdsInternalUrl:          reader.ReadStringOrDefault("ORDERS_ADS_INTERNAL_URL", ""),
		AdsInternalToken:        reader.ReadStringOrDefault("ADS_INTERNAL_SHARED_SECRET", ""),
		AdminInternalUrl:        reader.ReadStringOrDefault("ADMIN_INTERNAL_URL", ""),
		AdminInternalToken:      reader.ReadStringOrDefault("ADMIN_INTERNAL_API_TOKEN", ""),
		CheckoutCurrencies:      reader.ReadCommaSeparatedListOrDefault("ORDERS_CHECKOUT_CURRENCIES", []string{"NGN", "USD"}),
	}
	settings.AllowInMemoryMoneyFake = !settings.IsProduction()
	if settings.IsProduction() {
		settings.MoneyGrpcAddress = reader.ReadRequiredString("ORDERS_MONEY_GRPC_ADDRESS")
		settings.RedisUrl = reader.ReadRequiredString("ORDERS_REDIS_URL")
		if len(settings.MoneyGrpcToken) < 32 {
			reader.ReadRequiredString("ORDERS_MONEY_GRPC_TOKEN_OF_AT_LEAST_32_CHARACTERS")
		}
	}
	return settings
}
