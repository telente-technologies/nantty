package configs

import (
	"strings"
	"time"

	platformconfig "nantty/platform/config"
)

type IdentityVerificationSettings struct {
	SmileIdPartnerId                    string
	SmileIdApiKey                       string
	SmileIdEnabledProducts              []string
	SmileIdEnabledDocumentTypes         []string
	SmileIdEnabledEnhancedDocumentTypes []string
	SmileIdEnabledIdNumberTypes         []string
	SmileIdEnvironment                  string
	SmileIdCallbackUrl                  string
	SmileIdWebSdkCallbackUrl            string
	SmileIdHostedLinkCallbackUrl        string
	SmileIdBaseUrl                      string
	PrivacyPolicyUrl                    string
	ConsentVersion                      string
	DocumentFingerprintKey              string
	IntelligenceUrl                     string
	IntelligenceSecret                  string
	IntelligenceTimeout                 time.Duration
	EligibilityRecheckEvery             time.Duration
	EligibilityWorkerInterval           time.Duration
	WebAppBaseUrl                       string
}

func (settings IdentityVerificationSettings) SmileIdConfigured() bool {
	return settings.SmileIdPartnerId != "" && settings.SmileIdApiKey != ""
}

func ReadIdentityVerificationSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) IdentityVerificationSettings {
	environment := reader.ReadStringOrDefault("SMILE_ID_ENVIRONMENT", "sandbox")
	baseUrl := "https://testapi.smileidentity.com"
	if environment == "production" {
		baseUrl = "https://api.smileidentity.com"
	} else if environment != "sandbox" {
		reader.ReportProblem("SMILE_ID_ENVIRONMENT must be sandbox or production")
		environment = "sandbox"
	}
	configuredBaseUrl := reader.ReadStringOrDefault("SMILE_ID_BASE_URL", baseUrl)
	configuredBaseUrl = strings.TrimSuffix(configuredBaseUrl, "/v1")
	return IdentityVerificationSettings{
		SmileIdPartnerId:                    reader.ReadStringOrDefault("SMILE_ID_PARTNER_ID", ""),
		SmileIdApiKey:                       reader.ReadStringOrDefault("SMILE_ID_API_KEY", ""),
		SmileIdEnabledProducts:              normalizedSmileProducts(reader.ReadCommaSeparatedListOrDefault("SMILE_ID_ENABLED_PRODUCTS", nil)),
		SmileIdEnabledDocumentTypes:         normalizedSmileTypePairs(reader.ReadCommaSeparatedListOrDefault("SMILE_ID_ENABLED_DOCUMENT_TYPES", nil)),
		SmileIdEnabledEnhancedDocumentTypes: normalizedSmileTypePairs(reader.ReadCommaSeparatedListOrDefault("SMILE_ID_ENABLED_ENHANCED_DOCUMENT_TYPES", nil)),
		SmileIdEnabledIdNumberTypes:         normalizedSmileTypePairs(reader.ReadCommaSeparatedListOrDefault("SMILE_ID_ENABLED_ID_NUMBER_TYPES", nil)),
		SmileIdEnvironment:                  environment,
		SmileIdCallbackUrl:                  reader.ReadStringOrDefault("SMILE_ID_CALLBACK_URL", ""),
		SmileIdWebSdkCallbackUrl:            reader.ReadStringOrDefault("SMILE_ID_WEB_SDK_CALLBACK_URL", ""),
		SmileIdHostedLinkCallbackUrl:        reader.ReadStringOrDefault("SMILE_ID_HOSTED_LINK_CALLBACK_URL", ""),
		SmileIdBaseUrl:                      configuredBaseUrl,
		PrivacyPolicyUrl:                    reader.ReadStringOrDefault("VERIFICATION_PRIVACY_POLICY_URL", "https://nantty.com/privacy"),
		ConsentVersion:                      reader.ReadStringOrDefault("VERIFICATION_BIOMETRIC_CONSENT_VERSION", "2026-11-20"),
		DocumentFingerprintKey:              reader.ReadStringOrDefault("VERIFICATION_DOCUMENT_FINGERPRINT_KEY", ""),
		IntelligenceUrl:                     reader.ReadStringOrDefault("INTELLIGENCE_URL", ""),
		IntelligenceSecret:                  reader.ReadStringOrDefault("INTELLIGENCE_SHARED_SECRET", ""),
		IntelligenceTimeout:                 reader.ReadDurationOrDefault("USERS_INTELLIGENCE_TIMEOUT", 2*time.Second),
		EligibilityRecheckEvery:             reader.ReadDurationOrDefault("VERIFICATION_ELIGIBILITY_RECHECK_EVERY", 24*time.Hour),
		EligibilityWorkerInterval:           reader.ReadDurationOrDefault("VERIFICATION_ELIGIBILITY_WORKER_INTERVAL", time.Hour),
		WebAppBaseUrl:                       reader.ReadStringOrDefault("WEB_APP_BASE_URL", "https://nantty.com"),
	}
}

func normalizedSmileTypePairs(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		parts := strings.SplitN(strings.ToUpper(strings.TrimSpace(value)), ":", 2)
		if len(parts) == 2 && len(parts[0]) == 2 && parts[0][0] >= 'A' && parts[0][0] <= 'Z' && parts[0][1] >= 'A' && parts[0][1] <= 'Z' && parts[1] != "" {
			validType := true
			for _, char := range parts[1] {
				if (char < 'A' || char > 'Z') && (char < '0' || char > '9') && char != '_' {
					validType = false
					break
				}
			}
			if validType {
				result = append(result, parts[0]+":"+parts[1])
			}
		}
	}
	return result
}

func normalizedSmileProducts(products []string) []string {
	allowed := map[string]bool{"document_verification": true, "enhanced_document_verification": true, "enhanced_kyc": true}
	result := make([]string, 0, len(products))
	for _, product := range products {
		product = strings.ToLower(strings.TrimSpace(product))
		if allowed[product] {
			result = append(result, product)
		}
	}
	return result
}
