package configs

import (
	"time"

	platformconfig "nantty/platform/config"
)

type IdentityVerificationSettings struct {
	SmileIdPartnerId          string
	SmileIdApiKey             string
	SmileIdEnvironment        string
	SmileIdCallbackUrl        string
	SmileIdBaseUrl            string
	PrivacyPolicyUrl          string
	ConsentVersion            string
	DocumentFingerprintKey    string
	IntelligenceUrl           string
	IntelligenceSecret        string
	IntelligenceTimeout       time.Duration
	EligibilityRecheckEvery   time.Duration
	EligibilityWorkerInterval time.Duration
	WebAppBaseUrl             string
}

func (settings IdentityVerificationSettings) SmileIdConfigured() bool {
	return settings.SmileIdPartnerId != "" && settings.SmileIdApiKey != ""
}

func ReadIdentityVerificationSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) IdentityVerificationSettings {
	environment := reader.ReadStringOrDefault("SMILE_ID_ENVIRONMENT", "sandbox")
	baseUrl := "https://testapi.smileidentity.com/v1"
	if environment == "production" {
		baseUrl = "https://api.smileidentity.com/v1"
	}
	return IdentityVerificationSettings{
		SmileIdPartnerId:          reader.ReadStringOrDefault("SMILE_ID_PARTNER_ID", ""),
		SmileIdApiKey:             reader.ReadStringOrDefault("SMILE_ID_API_KEY", ""),
		SmileIdEnvironment:        environment,
		SmileIdCallbackUrl:        reader.ReadStringOrDefault("SMILE_ID_CALLBACK_URL", ""),
		SmileIdBaseUrl:            reader.ReadStringOrDefault("SMILE_ID_BASE_URL", baseUrl),
		PrivacyPolicyUrl:          reader.ReadStringOrDefault("VERIFICATION_PRIVACY_POLICY_URL", "https://zudomart.com/legal/privacy"),
		ConsentVersion:            reader.ReadStringOrDefault("VERIFICATION_BIOMETRIC_CONSENT_VERSION", "2026-10-04"),
		DocumentFingerprintKey:    reader.ReadStringOrDefault("VERIFICATION_DOCUMENT_FINGERPRINT_KEY", ""),
		IntelligenceUrl:           reader.ReadStringOrDefault("INTELLIGENCE_URL", ""),
		IntelligenceSecret:        reader.ReadStringOrDefault("INTELLIGENCE_SHARED_SECRET", ""),
		IntelligenceTimeout:       reader.ReadDurationOrDefault("USERS_INTELLIGENCE_TIMEOUT", 2*time.Second),
		EligibilityRecheckEvery:   reader.ReadDurationOrDefault("VERIFICATION_ELIGIBILITY_RECHECK_EVERY", 24*time.Hour),
		EligibilityWorkerInterval: reader.ReadDurationOrDefault("VERIFICATION_ELIGIBILITY_WORKER_INTERVAL", time.Hour),
		WebAppBaseUrl:             reader.ReadStringOrDefault("WEB_APP_BASE_URL", "https://zudomart.com"),
	}
}
