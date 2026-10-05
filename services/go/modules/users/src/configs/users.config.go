package configs

import (
	"encoding/base64"
	"time"

	platformconfig "zudomart/platform/config"
	"zudomart/platform/usersdirectory"
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
	AddressPhoneKey             []byte
	EntitlementEventsQueue      string
	SocialInternalUrl           string
	SocialInternalToken         string
	LiveInternalUrl             string
	LiveInternalToken           string
	Verification                IdentityVerificationSettings
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
		SocialInternalUrl:           reader.ReadStringOrDefault("USERS_SOCIAL_INTERNAL_URL", ""),
		SocialInternalToken:         reader.ReadStringOrDefault("SOCIAL_INTERNAL_API_TOKEN", ""),
		LiveInternalUrl:             reader.ReadStringOrDefault("USERS_LIVE_INTERNAL_URL", ""),
		LiveInternalToken:           reader.ReadStringOrDefault("LIVE_INTERNAL_API_TOKEN", ""),
		Verification:                ReadIdentityVerificationSettingsFromEnvironment(reader),
	}
	settings.AddressPhoneKey = readAddressPhoneKey(reader, settings.IsProduction())
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

func readAddressPhoneKey(reader *platformconfig.EnvironmentReader, isProduction bool) []byte {
	encoded := reader.ReadStringOrDefault(usersdirectory.AddressPhoneKeyVariable, "")
	if isProduction {
		encoded = reader.ReadRequiredString(usersdirectory.AddressPhoneKeyVariable)
	}
	key, err := usersdirectory.DecodeAddressPhoneKey(encoded)
	if err != nil {
		reader.ReadRequiredString(usersdirectory.AddressPhoneKeyVariable + "_AS_BASE64_OF_32_BYTES")
	}
	return key
}
