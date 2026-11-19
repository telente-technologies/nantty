package controllers_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"nantty/modules/users/src/configs"
	"nantty/modules/users/src/container"
	"nantty/modules/users/src/integrations"
	"nantty/modules/users/src/modules/identityVerification/controllers"
)

func TestSmileCallbackRejectsOversizedBodyWithPayloadTooLarge(t *testing.T) {
	controller := controllers.IdentityVerificationController{Container: &container.Container{}}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/webhooks/smile-id", strings.NewReader(strings.Repeat("x", (256<<10)+1)))
	recorder := httptest.NewRecorder()
	controller.SmileCallback(recorder, request)

	if recorder.Code != http.StatusRequestEntityTooLarge || !strings.Contains(recorder.Body.String(), "CALLBACK_TOO_LARGE") {
		t.Fatalf("oversized Smile callback should be rejected explicitly: status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}

type catalogCapture struct{ documentCalls, kycCalls, entitlementCalls int }

func (fake *catalogCapture) CreateWebToken(context.Context, integrations.SmileIdCaptureRequest) (string, error) {
	return "", nil
}

func (fake *catalogCapture) CreateSmileLink(context.Context, integrations.SmileIdCaptureRequest) (string, error) {
	return "", nil
}

func (fake *catalogCapture) SupportedDocuments(_ context.Context, country string) ([]integrations.SmileIdDocumentCountry, error) {
	fake.documentCalls++
	countries := []integrations.SmileIdDocumentCountry{{IDTypes: []integrations.SmileIdDocumentType{{Code: "PASSPORT", Name: "Passport"}, {Code: "VOTER_ID", Name: "Voter's ID"}}}}
	countries[0].Country.Code, countries[0].Country.Name = "NG", "Nigeria"
	if country != "" {
		return countries[:1], nil
	}
	us := integrations.SmileIdDocumentCountry{IDTypes: []integrations.SmileIdDocumentType{{Code: "PASSPORT", Name: "Passport"}}}
	us.Country.Code, us.Country.Name = "US", "United States"
	return append(countries, us), nil
}

func (fake *catalogCapture) SupportedKycTypes(_ context.Context, country string) ([]integrations.SmileIdSupportedKycType, error) {
	fake.kycCalls++
	if country == "" {
		return []integrations.SmileIdSupportedKycType{
			{Country: "NG", Type: "NIN_V2", Label: "National ID (NIN)"},
			{Country: "NG", Type: "V_NIN", Label: "Virtual NIN"},
			{Country: "NG", Type: "BANK_ACCOUNT", Label: "Bank Account", RequiredFields: []string{"bank_code"}, BankCode: "058"},
		}, nil
	}
	return []integrations.SmileIdSupportedKycType{
		{Country: country, Type: "NIN_V2", Label: "National ID (NIN)"},
		{Country: country, Type: "V_NIN", Label: "Virtual NIN"},
		{Country: country, Type: "BANK_ACCOUNT", Label: "Bank Account", RequiredFields: []string{"bank_code"}, BankCode: "058"},
	}, nil
}

func (fake *catalogCapture) EnhancedDocumentEntitlements(context.Context) (map[string][]string, error) {
	fake.entitlementCalls++
	return map[string][]string{"NG": {"VOTER_ID"}}, nil
}

func TestDocumentTypesFiltersGlobalCatalogByExactAccountEnabledTypePairs(t *testing.T) {
	fake := &catalogCapture{}
	controller := controllers.IdentityVerificationController{Container: &container.Container{
		IdentityCapture: fake,
		Settings: configs.UsersSettings{Verification: configs.IdentityVerificationSettings{
			SmileIdEnabledProducts:      []string{"document_verification", "enhanced_document_verification", "enhanced_kyc"},
			SmileIdEnabledDocumentTypes: []string{"NG:PASSPORT", "US:PASSPORT"}, SmileIdEnabledEnhancedDocumentTypes: []string{"NG:VOTER_ID", "NG:PASSPORT"}, SmileIdEnabledIdNumberTypes: []string{"NG:NIN_V2", "NG:BANK_ACCOUNT"},
		}},
	}}
	recorder := httptest.NewRecorder()
	controller.DocumentTypes(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/verification/document-types", nil))
	var countries struct {
		Countries []struct {
			Code string `json:"code"`
		} `json:"countries"`
		Availability struct {
			Documents         bool `json:"documentVerification"`
			EnhancedDocuments bool `json:"enhancedDocumentVerification"`
			IdNumbers         bool `json:"idNumberVerification"`
		} `json:"availability"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &countries); err != nil || recorder.Code != http.StatusOK {
		t.Fatalf("country catalog response: status=%d body=%s err=%v", recorder.Code, recorder.Body.String(), err)
	}
	if len(countries.Countries) != 2 || countries.Countries[0].Code != "NG" || countries.Countries[1].Code != "US" || !countries.Availability.Documents || !countries.Availability.EnhancedDocuments || !countries.Availability.IdNumbers {
		t.Fatalf("unexpected global catalog or product availability: %+v", countries)
	}
	if fake.documentCalls != 1 || fake.kycCalls != 1 || fake.entitlementCalls != 1 {
		t.Fatalf("provider catalog and entitlement calls must follow enabled products, got documents=%d KYC=%d entitlements=%d", fake.documentCalls, fake.kycCalls, fake.entitlementCalls)
	}
	recorder = httptest.NewRecorder()
	controller.DocumentTypes(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/verification/document-types?country=NG", nil))
	var options struct {
		DocumentTypes         []integrations.SmileIdDocumentType     `json:"documentTypes"`
		EnhancedDocumentTypes []integrations.SmileIdDocumentType     `json:"enhancedDocumentTypes"`
		IdNumberTypes         []integrations.SmileIdSupportedKycType `json:"idNumberTypes"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &options); err != nil || recorder.Code != http.StatusOK {
		t.Fatalf("filtered type response: status=%d body=%s err=%v", recorder.Code, recorder.Body.String(), err)
	}
	if len(options.DocumentTypes) != 1 || options.DocumentTypes[0].Code != "PASSPORT" || len(options.EnhancedDocumentTypes) != 1 || options.EnhancedDocumentTypes[0].Code != "VOTER_ID" || len(options.IdNumberTypes) != 1 || options.IdNumberTypes[0].Type != "NIN_V2" {
		t.Fatalf("only exact partner-enabled country/type pairs may be returned: %+v", options)
	}
}

func TestDocumentTypesUsesGlobalPhotoDocumentCatalogWhenNoOptionalRestrictionIsConfigured(t *testing.T) {
	fake := &catalogCapture{}
	controller := controllers.IdentityVerificationController{Container: &container.Container{
		IdentityCapture: fake,
		Settings: configs.UsersSettings{Verification: configs.IdentityVerificationSettings{
			SmileIdEnabledProducts: []string{"document_verification"},
		}},
	}}
	recorder := httptest.NewRecorder()
	controller.DocumentTypes(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/verification/document-types", nil))
	var response struct {
		Countries []struct {
			Code string `json:"code"`
		} `json:"countries"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil || recorder.Code != http.StatusOK {
		t.Fatalf("global document country response: status=%d body=%s err=%v", recorder.Code, recorder.Body.String(), err)
	}
	if len(response.Countries) != 2 || response.Countries[0].Code != "NG" || response.Countries[1].Code != "US" {
		t.Fatalf("standard document verification should return all countries from Smile's global catalog: %+v", response.Countries)
	}
	recorder = httptest.NewRecorder()
	controller.DocumentTypes(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/verification/document-types?country=NG", nil))
	var types struct {
		DocumentTypes []integrations.SmileIdDocumentType `json:"documentTypes"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &types); err != nil || len(types.DocumentTypes) != 2 {
		t.Fatalf("standard document verification should expose each supported document type by default: %+v err=%v", types.DocumentTypes, err)
	}
}

func TestDocumentTypesDoesNotExposePublicCatalogWithoutEnabledProduct(t *testing.T) {
	fake := &catalogCapture{}
	controller := controllers.IdentityVerificationController{Container: &container.Container{IdentityCapture: fake}}
	recorder := httptest.NewRecorder()
	controller.DocumentTypes(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/verification/document-types?country=NG", nil))
	var response struct {
		DocumentTypes []integrations.SmileIdDocumentType     `json:"documentTypes"`
		IdNumberTypes []integrations.SmileIdSupportedKycType `json:"idNumberTypes"`
		Availability  struct {
			Documents bool `json:"documentVerification"`
			IdNumbers bool `json:"idNumberVerification"`
		} `json:"availability"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil || recorder.Code != http.StatusOK {
		t.Fatalf("type catalog response: status=%d body=%s err=%v", recorder.Code, recorder.Body.String(), err)
	}
	if len(response.DocumentTypes) != 0 || len(response.IdNumberTypes) != 0 || response.Availability.Documents || response.Availability.IdNumbers || fake.documentCalls != 0 || fake.kycCalls != 0 || fake.entitlementCalls != 0 {
		t.Fatalf("unverified partner products must not be advertised: response=%+v calls=%d/%d/%d", response, fake.documentCalls, fake.kycCalls, fake.entitlementCalls)
	}
}

func TestIdNumberOnlyCountryListDoesNotDependOnPhotoDocumentCatalog(t *testing.T) {
	fake := &catalogCapture{}
	controller := controllers.IdentityVerificationController{Container: &container.Container{
		IdentityCapture: fake,
		Settings: configs.UsersSettings{Verification: configs.IdentityVerificationSettings{
			SmileIdEnabledProducts: []string{"enhanced_kyc"}, SmileIdEnabledIdNumberTypes: []string{"NG:NIN_V2"},
		}},
	}}
	recorder := httptest.NewRecorder()
	controller.DocumentTypes(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/verification/document-types", nil))
	var response struct {
		Countries []struct {
			Code string `json:"code"`
			Name string `json:"name"`
		} `json:"countries"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil || recorder.Code != http.StatusOK {
		t.Fatalf("ID-number country response: status=%d body=%s err=%v", recorder.Code, recorder.Body.String(), err)
	}
	if fake.documentCalls != 0 || fake.kycCalls != 1 || len(response.Countries) != 1 || response.Countries[0].Code != "NG" || response.Countries[0].Name != "Nigeria" {
		t.Fatalf("ID-number catalog should be independent and return readable country labels: calls=%d/%d countries=%+v", fake.documentCalls, fake.kycCalls, response.Countries)
	}
}
