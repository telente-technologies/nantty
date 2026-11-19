package configs_test

import (
	"testing"

	"nantty/modules/users/src/configs"
	"nantty/platform/config"
)

func TestSmileProductsRequireExplicitSupportedAccountConfiguration(t *testing.T) {
	t.Setenv("SMILE_ID_ENABLED_PRODUCTS", " document_verification,ENHANCED_DOCUMENT_VERIFICATION,ENHANCED_KYC,residency_document_verification,unknown ")
	t.Setenv("SMILE_ID_ENABLED_DOCUMENT_TYPES", "ng:passport,US:DriverS-License,NG:VOTER_ID,broken")
	t.Setenv("SMILE_ID_ENABLED_ENHANCED_DOCUMENT_TYPES", "ng:voter_id,KE:IDENTITY_CARD")
	t.Setenv("SMILE_ID_ENABLED_ID_NUMBER_TYPES", "ng:nin_v2,CI:BVN,NG:bad.type")
	t.Setenv("SMILE_ID_CALLBACK_URL", "https://api.example.test/api/v1/webhooks/smile-id")
	t.Setenv("SMILE_ID_WEB_SDK_CALLBACK_URL", "https://api.example.test/api/v1/webhooks/smile-id/web-sdk")
	t.Setenv("SMILE_ID_HOSTED_LINK_CALLBACK_URL", "https://api.example.test/api/v1/webhooks/smile-id/hosted-link")
	settings := configs.ReadIdentityVerificationSettingsFromEnvironment(config.NewEnvironmentReader())
	if settings.SmileIdCallbackUrl != "https://api.example.test/api/v1/webhooks/smile-id" || settings.SmileIdWebSdkCallbackUrl != "https://api.example.test/api/v1/webhooks/smile-id/web-sdk" || settings.SmileIdHostedLinkCallbackUrl != "https://api.example.test/api/v1/webhooks/smile-id/hosted-link" {
		t.Fatalf("Smile callback settings = legacy:%q web:%q hosted:%q", settings.SmileIdCallbackUrl, settings.SmileIdWebSdkCallbackUrl, settings.SmileIdHostedLinkCallbackUrl)
	}
	if len(settings.SmileIdEnabledProducts) != 3 || settings.SmileIdEnabledProducts[0] != "document_verification" || settings.SmileIdEnabledProducts[1] != "enhanced_document_verification" || settings.SmileIdEnabledProducts[2] != "enhanced_kyc" {
		t.Fatalf("enabled Smile products = %#v", settings.SmileIdEnabledProducts)
	}
	if len(settings.SmileIdEnabledDocumentTypes) != 2 || settings.SmileIdEnabledDocumentTypes[0] != "NG:PASSPORT" || settings.SmileIdEnabledDocumentTypes[1] != "NG:VOTER_ID" {
		t.Fatalf("enabled Smile document type pairs = %#v", settings.SmileIdEnabledDocumentTypes)
	}
	if len(settings.SmileIdEnabledEnhancedDocumentTypes) != 2 || settings.SmileIdEnabledEnhancedDocumentTypes[0] != "NG:VOTER_ID" || settings.SmileIdEnabledEnhancedDocumentTypes[1] != "KE:IDENTITY_CARD" {
		t.Fatalf("enabled Smile Enhanced Document type pairs = %#v", settings.SmileIdEnabledEnhancedDocumentTypes)
	}
	if len(settings.SmileIdEnabledIdNumberTypes) != 2 || settings.SmileIdEnabledIdNumberTypes[0] != "NG:NIN_V2" || settings.SmileIdEnabledIdNumberTypes[1] != "CI:BVN" {
		t.Fatalf("enabled Smile ID-number type pairs = %#v", settings.SmileIdEnabledIdNumberTypes)
	}
	t.Setenv("SMILE_ID_ENABLED_PRODUCTS", "")
	t.Setenv("SMILE_ID_ENABLED_DOCUMENT_TYPES", "")
	t.Setenv("SMILE_ID_ENABLED_ENHANCED_DOCUMENT_TYPES", "")
	t.Setenv("SMILE_ID_ENABLED_ID_NUMBER_TYPES", "")
	t.Setenv("SMILE_ID_CALLBACK_URL", "")
	t.Setenv("SMILE_ID_WEB_SDK_CALLBACK_URL", "")
	t.Setenv("SMILE_ID_HOSTED_LINK_CALLBACK_URL", "")
	settings = configs.ReadIdentityVerificationSettingsFromEnvironment(config.NewEnvironmentReader())
	if len(settings.SmileIdEnabledProducts) != 0 || len(settings.SmileIdEnabledDocumentTypes) != 0 || len(settings.SmileIdEnabledEnhancedDocumentTypes) != 0 || len(settings.SmileIdEnabledIdNumberTypes) != 0 {
		t.Fatalf("unset Smile ID activation must fail closed, got %+v", settings)
	}
}
