package configs

import (
	platformconfig "zudomart/platform/config"
)

type ModerationSettings struct {
	Environment          string
	DatabaseUrl          string
	DatabaseSchema       string
	DomainEventsTopicArn string
	JwksUrl              string
	TokenIssuer          string
	TokenAudience        string
	UsersInternalUrl     string
	UsersInternalToken   string
	IntakeToken          string
	AdminInternalToken   string
	ReportsPerHour       int
	AdvisoryQueueUrl     string
}

func (settings ModerationSettings) IsProduction() bool { return settings.Environment == "production" }

func ReadModerationSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) ModerationSettings {
	settings := ModerationSettings{
		Environment:          reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:          reader.ReadRequiredString("MODERATION_DATABASE_URL"),
		DatabaseSchema:       reader.ReadStringOrDefault("MODERATION_DATABASE_SCHEMA", "moderation"),
		DomainEventsTopicArn: reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		JwksUrl:              reader.ReadRequiredString("AUTH_JWKS_URL"),
		TokenIssuer:          reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.zudomart.com"),
		TokenAudience:        reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "zudomart-api"),
		UsersInternalUrl:     reader.ReadStringOrDefault("MODERATION_USERS_INTERNAL_URL", "http://localhost:8101"),
		UsersInternalToken:   reader.ReadStringOrDefault("USERS_INTERNAL_API_TOKEN", ""),
		IntakeToken:          reader.ReadStringOrDefault("MODERATION_INTERNAL_API_TOKEN", ""),
		AdminInternalToken:   reader.ReadStringOrDefault("ADMIN_INTERNAL_API_TOKEN", ""),
		ReportsPerHour:       reader.ReadIntegerOrDefault("MODERATION_REPORTS_PER_HOUR", 5),
		AdvisoryQueueUrl:     reader.ReadStringOrDefault("INTELLIGENCE_TRUST_ADVISORY_QUEUE_URL", ""),
	}
	reader.RequireMinimumLength("USERS_INTERNAL_API_TOKEN", settings.UsersInternalToken, 32)
	reader.RequireMinimumLength("ADMIN_INTERNAL_API_TOKEN", settings.AdminInternalToken, 32)
	reader.RequireMinimumLength("MODERATION_INTERNAL_API_TOKEN", settings.IntakeToken, 32)
	return settings
}
