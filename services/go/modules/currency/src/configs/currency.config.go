package configs

import platformconfig "nantty/platform/config"

type CurrencySettings struct {
	Environment          string
	DatabaseUrl          string
	DatabaseSchema       string
	DomainEventsTopicArn string
	TokenIssuer          string
	TokenAudience        string
	TrustedCountryHeader string
}

func (settings CurrencySettings) IsProduction() bool { return settings.Environment == "production" }

func ReadCurrencySettingsFromEnvironment(reader *platformconfig.EnvironmentReader) CurrencySettings {
	return CurrencySettings{
		Environment:          reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:          reader.ReadRequiredString("CURRENCY_DATABASE_URL"),
		DatabaseSchema:       reader.ReadStringOrDefault("CURRENCY_DATABASE_SCHEMA", "currency"),
		DomainEventsTopicArn: reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		TokenIssuer:          reader.ReadStringOrDefault("CURRENCY_TOKEN_ISSUER", "https://auth.nantty.com"),
		TokenAudience:        reader.ReadStringOrDefault("CURRENCY_TOKEN_AUDIENCE", "nantty-api"),
		TrustedCountryHeader: reader.ReadStringOrDefault("CURRENCY_TRUSTED_COUNTRY_HEADER", "CloudFront-Viewer-Country"),
	}
}
