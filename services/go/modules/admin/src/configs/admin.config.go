package configs

import (
	"encoding/base64"
	"net/url"
	"time"

	ipallowlist "zudomart/modules/admin/src/utils/ipAllowList"
	platformconfig "zudomart/platform/config"
)

type AdminSettings struct {
	Environment            string
	DatabaseUrl            string
	DatabaseSchema         string
	DomainEventsTopicArn   string
	TotpEncryptionKey      []byte
	TotpIssuerLabel        string
	StaffRefreshTokenTtl   time.Duration
	InvitationTtl          time.Duration
	StepUpTtl              time.Duration
	LoginChallengeTtl      time.Duration
	MaximumFailedPasswords int
	LockoutDuration        time.Duration
	InternalApiToken       string
	DeliveryMode           string
	AllowedEmailDomains    []string
	IpAllowList            []string
	WebAuthn               WebAuthnSettings
	MetricsSources         MetricsSourceSchemas
}

type WebAuthnSettings struct {
	RelyingPartyId   string
	RelyingPartyName string
	Origins          []string
}

type MetricsSourceSchemas struct {
	Auth     string
	Users    string
	Payments string
	Escrow   string
	Wallet   string
}

func (settings AdminSettings) IsProduction() bool { return settings.Environment == "production" }

func ReadAdminSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) AdminSettings {
	settings := AdminSettings{
		Environment:            reader.ReadStringOrDefault("APP_ENV", "development"),
		DatabaseUrl:            reader.ReadRequiredString("ADMIN_DATABASE_URL"),
		DatabaseSchema:         reader.ReadStringOrDefault("ADMIN_DATABASE_SCHEMA", "admin"),
		DomainEventsTopicArn:   reader.ReadStringOrDefault("DOMAIN_EVENTS_TOPIC_ARN", ""),
		TotpEncryptionKey:      readBase64Key(reader, "ADMIN_TOTP_ENCRYPTION_KEY", 32),
		TotpIssuerLabel:        reader.ReadStringOrDefault("ADMIN_TOTP_ISSUER_LABEL", "Zudomart"),
		StaffRefreshTokenTtl:   reader.ReadDurationOrDefault("ADMIN_STAFF_REFRESH_TOKEN_TTL", 12*time.Hour),
		InvitationTtl:          reader.ReadDurationOrDefault("ADMIN_INVITATION_TTL", 72*time.Hour),
		StepUpTtl:              reader.ReadDurationOrDefault("ADMIN_STEP_UP_TTL", 5*time.Minute),
		LoginChallengeTtl:      reader.ReadDurationOrDefault("ADMIN_LOGIN_CHALLENGE_TTL", 5*time.Minute),
		MaximumFailedPasswords: reader.ReadIntegerOrDefault("ADMIN_MAX_FAILED_PASSWORDS", 5),
		LockoutDuration:        reader.ReadDurationOrDefault("ADMIN_LOCKOUT_DURATION", 15*time.Minute),
		InternalApiToken:       reader.ReadStringOrDefault("ADMIN_INTERNAL_API_TOKEN", ""),
		DeliveryMode:           reader.ReadStringOrDefault("ADMIN_INVITATION_DELIVERY", "log"),
		AllowedEmailDomains:    reader.ReadCommaSeparatedListOrDefault("ADMIN_ALLOWED_EMAIL_DOMAINS", nil),
		IpAllowList:            readIpAllowList(reader),
		WebAuthn:               readWebAuthnSettings(reader),
		MetricsSources: MetricsSourceSchemas{
			Auth:     reader.ReadStringOrDefault("AUTH_DATABASE_SCHEMA", "auth"),
			Users:    reader.ReadStringOrDefault("USERS_DATABASE_SCHEMA", "users"),
			Payments: reader.ReadStringOrDefault("PAYMENTS_DATABASE_SCHEMA", "payments"),
			Escrow:   reader.ReadStringOrDefault("ESCROW_DATABASE_SCHEMA", "escrow"),
			Wallet:   reader.ReadStringOrDefault("WALLET_DATABASE_SCHEMA", "wallet"),
		},
	}
	reader.RequireMinimumLength("ADMIN_INTERNAL_API_TOKEN", settings.InternalApiToken, 32)
	if settings.IsProduction() && settings.DeliveryMode == "log" {
		reader.ReadRequiredString("ADMIN_INVITATION_DELIVERY_NOT_LOG_IN_PRODUCTION")
	}
	return settings
}

func readIpAllowList(reader *platformconfig.EnvironmentReader) []string {
	entries, valid := ipallowlist.NormalizeEntries(reader.ReadCommaSeparatedListOrDefault("ADMIN_IP_ALLOWLIST", nil))
	if !valid {
		reader.ReadRequiredString("ADMIN_IP_ALLOWLIST_AS_VALID_IPS_OR_CIDRS")
		return nil
	}
	return entries
}

func readWebAuthnSettings(reader *platformconfig.EnvironmentReader) WebAuthnSettings {
	consoleUrl := reader.ReadStringOrDefault("ADMIN_CONSOLE_URL", "http://localhost:3400")
	relyingPartyId := reader.ReadStringOrDefault("ADMIN_WEBAUTHN_RP_ID", "")
	if parsed, err := url.Parse(consoleUrl); relyingPartyId == "" && err == nil {
		relyingPartyId = parsed.Hostname()
	}
	return WebAuthnSettings{
		RelyingPartyId:   relyingPartyId,
		RelyingPartyName: reader.ReadStringOrDefault("ADMIN_WEBAUTHN_RP_NAME", "Zudomart Admin"),
		Origins:          reader.ReadCommaSeparatedListOrDefault("ADMIN_WEBAUTHN_ORIGINS", []string{consoleUrl}),
	}
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
