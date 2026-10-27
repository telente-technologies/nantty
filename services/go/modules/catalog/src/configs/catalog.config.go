package configs

import (
	"crypto/sha256"
	"encoding/base64"
	"time"

	platformconfig "nantty/platform/config"
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
	AdminInternalUrl       string
	AdminInternalToken     string
	UsersInternalToken     string
	MediaInternalUrl       string
	MediaInternalToken     string
	DataEncryptionKey      []byte
	MartImageLibrary       string
	MartCountries          []string
	AdsInternalUrl         string
	AdsInternalSecret      string
}

func (settings CatalogSettings) IsProduction() bool { return settings.Environment == "production" }

func ReadCatalogSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) CatalogSettings {
	settings := CatalogSettings{
		Environment:            reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:            reader.ReadRequiredString("CATALOG_DATABASE_URL"),
		DatabaseSchema:         reader.ReadStringOrDefault("CATALOG_DATABASE_SCHEMA", "catalog"),
		DomainEventsTopicArn:   reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		AccessTokenJwksUrl:     reader.ReadStringOrDefault("AUTH_JWKS_URL", "http://localhost:8101/.well-known/jwks.json"),
		TokenIssuer:            reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.nantty.com"),
		TokenAudience:          reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "nantty-api"),
		RedisUrl:               reader.ReadStringOrDefault("CATALOG_REDIS_URL", ""),
		MediaPublicBaseUrl:     reader.ReadStringOrDefault("MEDIA_PUBLIC_BASE_URL", "http://localhost:18333/nantty-media-public"),
		InternalApiToken:       reader.ReadStringOrDefault("CATALOG_INTERNAL_API_TOKEN", ""),
		EventsQueueName:        reader.ReadStringOrDefault("CATALOG_EVENTS_QUEUE", ""),
		SocialInternalUrl:      reader.ReadStringOrDefault("CATALOG_SOCIAL_INTERNAL_URL", ""),
		SocialInternalToken:    reader.ReadStringOrDefault("CATALOG_SOCIAL_INTERNAL_TOKEN", ""),
		PublicWebBaseUrl:       reader.ReadStringOrDefault("PUBLIC_WEB_BASE_URL", "https://nantty.com"),
		ImportJobsQueue:        reader.ReadStringOrDefault("CATALOG_IMPORT_JOBS_QUEUE", "jobs-catalog-import"),
		ScheduledPublishPeriod: reader.ReadDurationOrDefault("CATALOG_SCHEDULED_PUBLISH_INTERVAL", 30*time.Second),
		AdminInternalUrl:       reader.ReadStringOrDefault("ADMIN_INTERNAL_URL", ""),
		AdminInternalToken:     reader.ReadStringOrDefault("ADMIN_INTERNAL_API_TOKEN", ""),
		UsersInternalToken:     reader.ReadStringOrDefault("USERS_INTERNAL_API_TOKEN", ""),
		MediaInternalUrl:       reader.ReadStringOrDefault("MEDIA_INTERNAL_URL", ""),
		MediaInternalToken:     reader.ReadStringOrDefault("MEDIA_INTERNAL_TOKEN", ""),
		MartImageLibrary:       reader.ReadStringOrDefault("CATALOG_MART_IMAGE_LIBRARY", ""),
		MartCountries:          reader.ReadCommaSeparatedListOrDefault("CATALOG_MART_COUNTRIES", []string{"NG", "GH", "KE", "ZA", "GB", "US"}),
		AdsInternalUrl:         reader.ReadStringOrDefault("CATALOG_ADS_INTERNAL_URL", ""),
		AdsInternalSecret:      reader.ReadStringOrDefault("ADS_INTERNAL_SHARED_SECRET", ""),
	}
	settings.DataEncryptionKey = ReadDataEncryptionKey(reader, settings.IsProduction())
	if settings.IsProduction() {
		settings.RedisUrl = reader.ReadRequiredString("CATALOG_REDIS_URL")
	}
	return settings
}

var developmentDataKey = sha256.Sum256([]byte("nantty-catalog-local-only-data-key"))

func ReadDataEncryptionKey(reader *platformconfig.EnvironmentReader, isProduction bool) []byte {
	encoded := reader.ReadStringOrDefault("CATALOG_DATA_ENCRYPTION_KEY", "")
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if encoded == "" && !isProduction {
		return developmentDataKey[:]
	}
	if err != nil || len(decoded) != 32 {
		reader.ReadRequiredString("CATALOG_DATA_ENCRYPTION_KEY_AS_BASE64_OF_32_BYTES")
		return nil
	}
	return decoded
}
