package configs

import (
	"encoding/base64"
	"time"

	platformconfig "nantty/platform/config"
)

type AuthSettings struct {
	Environment                         string
	DatabaseUrl                         string
	DatabaseSchema                      string
	DomainEventsTopicArn                string
	TokenIssuer                         string
	TokenAudience                       string
	AccessTokenTimeToLive               time.Duration
	RefreshTokenTimeToLive              time.Duration
	SessionMaximumLifetime              time.Duration
	SigningKeyRotationInterval          time.Duration
	SigningKeyEncryptionKey             []byte
	OneTimeCodePepper                   []byte
	OneTimeCodeTimeToLive               time.Duration
	OneTimeCodeMaximumAttempts          int
	OneTimeCodeResendCooldown           time.Duration
	OneTimeCodeMaximumSendsPerHour      int
	VerifiedDestinationTokenTtl         time.Duration
	OneTimeCodeDeliveryMode             string
	GoogleClientIds                     []string
	AppleClientIds                      []string
	GoogleJwksUrl                       string
	AppleJwksUrl                        string
	StaffAccessTokenTimeToLive          time.Duration
	WidgetTokenTimeToLive               time.Duration
	DirectoryGrpcAddress                string
	InternalGrpcToken                   string
	BusinessMessagingCommerceUrl        string
	BusinessMessagingAuthorizationToken string
	OtpEventKey                         []byte
	OtpEventKeyId                       string
}

func (settings AuthSettings) IsProduction() bool { return settings.Environment == "production" }

func (settings AuthSettings) LongestUserTokenTimeToLive() time.Duration {
	return max(settings.AccessTokenTimeToLive, settings.WidgetTokenTimeToLive)
}

func ReadAuthSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) AuthSettings {
	settings := AuthSettings{
		Environment:                         reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:                         reader.ReadRequiredString("AUTH_DATABASE_URL"),
		DatabaseSchema:                      reader.ReadStringOrDefault("AUTH_DATABASE_SCHEMA", "auth"),
		DomainEventsTopicArn:                reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		TokenIssuer:                         reader.ReadStringOrDefault("AUTH_TOKEN_ISSUER", "https://auth.nantty.com"),
		TokenAudience:                       reader.ReadStringOrDefault("AUTH_TOKEN_AUDIENCE", "nantty-api"),
		AccessTokenTimeToLive:               reader.ReadDurationOrDefault("AUTH_ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTimeToLive:              reader.ReadDurationOrDefault("AUTH_REFRESH_TOKEN_TTL", 30*24*time.Hour),
		SessionMaximumLifetime:              reader.ReadDurationOrDefault("AUTH_SESSION_MAX_LIFETIME", 180*24*time.Hour),
		SigningKeyRotationInterval:          reader.ReadDurationOrDefault("AUTH_SIGNING_KEY_ROTATION_INTERVAL", 30*24*time.Hour),
		SigningKeyEncryptionKey:             readBase64Key(reader, "AUTH_SIGNING_KEY_ENCRYPTION_KEY", 32),
		OneTimeCodePepper:                   readBase64Key(reader, "AUTH_ONE_TIME_CODE_PEPPER", 32),
		OneTimeCodeTimeToLive:               reader.ReadDurationOrDefault("AUTH_OTP_TTL", 5*time.Minute),
		OneTimeCodeMaximumAttempts:          reader.ReadIntegerOrDefault("AUTH_OTP_MAX_ATTEMPTS", 5),
		OneTimeCodeResendCooldown:           reader.ReadDurationOrDefault("AUTH_OTP_RESEND_COOLDOWN", time.Minute),
		OneTimeCodeMaximumSendsPerHour:      reader.ReadIntegerOrDefault("AUTH_OTP_MAX_SENDS_PER_HOUR", 10),
		VerifiedDestinationTokenTtl:         reader.ReadDurationOrDefault("AUTH_VERIFIED_DESTINATION_TOKEN_TTL", 15*time.Minute),
		OneTimeCodeDeliveryMode:             reader.ReadStringOrDefault("AUTH_OTP_DELIVERY", "log"),
		GoogleClientIds:                     reader.ReadCommaSeparatedListOrDefault("AUTH_GOOGLE_CLIENT_IDS", nil),
		AppleClientIds:                      reader.ReadCommaSeparatedListOrDefault("AUTH_APPLE_CLIENT_IDS", nil),
		GoogleJwksUrl:                       reader.ReadStringOrDefault("AUTH_GOOGLE_JWKS_URL", "https://www.googleapis.com/oauth2/v3/certs"),
		AppleJwksUrl:                        reader.ReadStringOrDefault("AUTH_APPLE_JWKS_URL", "https://appleid.apple.com/auth/keys"),
		StaffAccessTokenTimeToLive:          reader.ReadDurationOrDefault("AUTH_STAFF_ACCESS_TOKEN_TTL", 10*time.Minute),
		WidgetTokenTimeToLive:               reader.ReadDurationOrDefault("AUTH_WIDGET_TOKEN_TTL", 24*time.Hour),
		DirectoryGrpcAddress:                reader.ReadStringOrDefault("AUTH_ACCOUNT_DIRECTORY_GRPC_ADDRESS", ""),
		InternalGrpcToken:                   reader.ReadStringOrDefault("AUTH_INTERNAL_GRPC_TOKEN", ""),
		BusinessMessagingCommerceUrl:        reader.ReadStringOrDefault("BUSINESS_MESSAGING_COMMERCE_INTERNAL_URL", ""),
		BusinessMessagingAuthorizationToken: reader.ReadStringOrDefault("BUSINESS_MESSAGING_AUTHORIZATION_TOKEN", ""),
		OtpEventKeyId:                       reader.ReadStringOrDefault("AUTH_OTP_EVENT_KEY_ID", "otp-1"),
	}
	if settings.WidgetTokenTimeToLive <= 0 || settings.WidgetTokenTimeToLive > 7*24*time.Hour {
		reader.ReadRequiredString("AUTH_WIDGET_TOKEN_TTL_BETWEEN_1S_AND_7_DAYS")
	}
	if settings.OneTimeCodeDeliveryMode == "event" {
		settings.OtpEventKey = readBase64Key(reader, "AUTH_OTP_EVENT_KEY", 32)
	}
	if settings.IsProduction() && settings.DirectoryGrpcAddress != "" && len(settings.InternalGrpcToken) < 32 {
		reader.ReportProblem("AUTH_INTERNAL_GRPC_TOKEN must be at least 32 characters in production")
	}
	if settings.OneTimeCodeDeliveryMode != "log" && settings.OneTimeCodeDeliveryMode != "event" {
		reader.ReportProblem("AUTH_OTP_DELIVERY must be log or event")
	}
	if settings.OneTimeCodeMaximumSendsPerHour < 1 {
		reader.ReportProblem("AUTH_OTP_MAX_SENDS_PER_HOUR must be at least 1")
	}
	if settings.IsProduction() && settings.OneTimeCodeDeliveryMode == "log" {
		reader.ReportProblem("AUTH_OTP_DELIVERY must not be log in production")
	}
	return settings
}

func readBase64Key(reader *platformconfig.EnvironmentReader, name string, length int) []byte {
	encoded := reader.ReadRequiredString(name)
	if encoded == "" {
		return nil
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(decoded) != length {
		reader.ReadRequiredString(name + "_AS_BASE64_OF_32_BYTES")
		return nil
	}
	return decoded
}
