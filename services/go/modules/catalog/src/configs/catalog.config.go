package configs

import (
	"time"

	platformconfig "zudomart/platform/config"
)

type CatalogSettings struct {
	Environment            string
	DatabaseUrl            string
	DatabaseSchema         string
	DomainEventsTopicArn   string
	AccessTokenJwksUrl     string
	TokenIssuer            string
	TokenAudience          string
	RedisUrl               string
	MediaPublicBaseUrl     string
	ScheduledPublishPeriod time.Duration
	OutboxBatchSize        int
	InternalApiToken       string
	EventsQueueName        string
	SocialInternalUrl      string
	SocialInternalToken    string
	PublicWebBaseUrl       string
	ImportJobsQueue        string
}

func (settings CatalogSettings) IsProduction() bool { return settings.Environment == "production" }

func ReadCatalogSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) CatalogSettings {
	return CatalogSettings{
		Environment:            reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:            reader.ReadRequiredString("CATALOG_DATABASE_URL"),
		DatabaseSchema:         reader.ReadStringOrDefault("CATALOG_DATABASE_SCHEMA", "catalog"),
		DomainEventsTopicArn:   reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		AccessTokenJwksUrl:     reader.ReadStringOrDefault("AUTH_JWKS_URL", "http://localhost:8101/.well-known/jwks.json"),
		TokenIssuer:            reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.zudomart.com"),
		TokenAudience:          reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "zudomart-api"),
		RedisUrl:               reader.ReadStringOrDefault("CATALOG_REDIS_URL", ""),
		MediaPublicBaseUrl:     reader.ReadStringOrDefault("MEDIA_PUBLIC_BASE_URL", "http://localhost:18333/zudomart-media"),
		InternalApiToken:       reader.ReadStringOrDefault("CATALOG_INTERNAL_API_TOKEN", ""),
		EventsQueueName:        reader.ReadStringOrDefault("CATALOG_EVENTS_QUEUE", ""),
		SocialInternalUrl:      reader.ReadStringOrDefault("CATALOG_SOCIAL_INTERNAL_URL", ""),
		SocialInternalToken:    reader.ReadStringOrDefault("CATALOG_SOCIAL_INTERNAL_TOKEN", ""),
		PublicWebBaseUrl:       reader.ReadStringOrDefault("PUBLIC_WEB_BASE_URL", "https://zudomart.com"),
		ImportJobsQueue:        reader.ReadStringOrDefault("CATALOG_IMPORT_JOBS_QUEUE", "jobs-catalog-import"),
		ScheduledPublishPeriod: reader.ReadDurationOrDefault("CATALOG_SCHEDULED_PUBLISH_INTERVAL", 30*time.Second),
	}
}
