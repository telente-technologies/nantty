package configs

import platformconfig "nantty/platform/config"

type AnalyticsSettings struct {
	Environment        string
	DatabaseUrl        string
	DatabaseSchema     string
	AccessTokenJwksUrl string
	TokenIssuer        string
	TokenAudience      string
	InternalApiToken   string
	RetentionDays      int
	MaxBatchSize       int
}

func (settings AnalyticsSettings) IsProduction() bool {
	return settings.Environment == "production"
}

func ReadAnalyticsSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) AnalyticsSettings {
	settings := AnalyticsSettings{
		Environment:        reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:        reader.ReadStringOrDefault("ANALYTICS_DATABASE_URL", ""),
		DatabaseSchema:     reader.ReadStringOrDefault("ANALYTICS_DATABASE_SCHEMA", "analytics"),
		AccessTokenJwksUrl: reader.ReadStringOrDefault("AUTH_JWKS_URL", "http://localhost:8101/.well-known/jwks.json"),
		TokenIssuer:        reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.nantty.com"),
		TokenAudience:      reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "nantty-api"),
		InternalApiToken:   reader.ReadStringOrDefault("ANALYTICS_INTERNAL_API_TOKEN", ""),
		RetentionDays:      reader.ReadIntegerOrDefault("ANALYTICS_RETENTION_DAYS", 90),
		MaxBatchSize:       reader.ReadIntegerOrDefault("ANALYTICS_MAX_BATCH_SIZE", 50),
	}
	if settings.DatabaseUrl == "" {
		settings.DatabaseUrl = reader.ReadStringOrDefault("ORDERS_DATABASE_URL", "")
	}
	if settings.IsProduction() && settings.DatabaseUrl == "" {
		settings.DatabaseUrl = reader.ReadRequiredString("ANALYTICS_DATABASE_URL")
	}
	if settings.RetentionDays <= 0 {
		settings.RetentionDays = 90
	}
	if settings.MaxBatchSize <= 0 || settings.MaxBatchSize > 100 {
		settings.MaxBatchSize = 50
	}
	return settings
}
