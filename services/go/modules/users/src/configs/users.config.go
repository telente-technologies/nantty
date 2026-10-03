package configs

import (
	"encoding/base64"
	"time"

	platformconfig "zudomart/platform/config"
)

type UsersSettings struct {
	Environment                 string
	DatabaseUrl                 string
	DatabaseSchema              string
	DomainEventsTopicArn        string
	TokenIssuer                 string
	TokenAudience               string
	UsernameChangeCooldown      time.Duration
	UsernameMaximumChangesYear  int
	UsernameQuarantine          time.Duration
	MediaPublicBaseUrl          string
	MediaUploadBaseUrl          string
	MediaUploadSigningKey       []byte
	MediaUploadIntentTimeToLive time.Duration
	Privacy                     PrivacySettings
	EntitlementEventsQueue      string
}

func (settings UsersSettings) IsProduction() bool { return settings.Environment == "production" }

func ReadUsersSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) UsersSettings {
	settings := UsersSettings{
		Environment:                 reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:                 reader.ReadRequiredString("USERS_DATABASE_URL"),
		DatabaseSchema:              reader.ReadStringOrDefault("USERS_DATABASE_SCHEMA", "users"),
		DomainEventsTopicArn:        reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		TokenIssuer:                 reader.ReadStringOrDefault("USERS_TOKEN_ISSUER", reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.zudomart.com")),
		TokenAudience:               reader.ReadStringOrDefault("USERS_TOKEN_AUDIENCE", reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "zudomart-api")),
		UsernameChangeCooldown:      time.Duration(reader.ReadIntegerOrDefault("USERS_USERNAME_CHANGE_COOLDOWN_DAYS", 30)) * 24 * time.Hour,
		UsernameMaximumChangesYear:  reader.ReadIntegerOrDefault("USERS_USERNAME_MAX_CHANGES_PER_YEAR", 3),
		UsernameQuarantine:          time.Duration(reader.ReadIntegerOrDefault("USERS_USERNAME_QUARANTINE_DAYS", 120)) * 24 * time.Hour,
		MediaPublicBaseUrl:          reader.ReadStringOrDefault("USERS_MEDIA_PUBLIC_BASE_URL", "http://localhost:18333/zudomart-media"),
		MediaUploadBaseUrl:          reader.ReadStringOrDefault("USERS_MEDIA_UPLOAD_BASE_URL", "http://localhost:18333/zudomart-media"),
		MediaUploadSigningKey:       readSigningKey(reader, "USERS_MEDIA_UPLOAD_SIGNING_KEY"),
		MediaUploadIntentTimeToLive: reader.ReadDurationOrDefault("USERS_MEDIA_UPLOAD_INTENT_TTL", 10*time.Minute),
		Privacy:                     ReadPrivacySettingsFromEnvironment(reader),
		EntitlementEventsQueue:      reader.ReadStringOrDefault("USERS_ENTITLEMENT_EVENTS_QUEUE", ""),
	}
	return settings
}

func readSigningKey(reader *platformconfig.EnvironmentReader, name string) []byte {
	encoded := reader.ReadRequiredString(name)
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if encoded != "" && (err != nil || len(decoded) < 32) {
		reader.ReadRequiredString(name + "_AS_BASE64_OF_AT_LEAST_32_BYTES")
		return nil
	}
	return decoded
}
