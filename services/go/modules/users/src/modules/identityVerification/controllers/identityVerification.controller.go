package controllers

import (
	"context"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/integrations"
	applysmileresult "nantty/modules/users/src/modules/identityVerification/commands/applySmileResult"
	cancelidentitycapture "nantty/modules/users/src/modules/identityVerification/commands/cancelIdentityCapture"
	replaysmilecallback "nantty/modules/users/src/modules/identityVerification/commands/replaySmileCallback"
	requestverification "nantty/modules/users/src/modules/identityVerification/commands/requestVerification"
	startidentitycapture "nantty/modules/users/src/modules/identityVerification/commands/startIdentityCapture"
	"nantty/modules/users/src/modules/identityVerification/dtos"
	getverificationjourney "nantty/modules/users/src/modules/identityVerification/queries/getVerificationJourney"
	"nantty/modules/users/src/modules/identityVerification/services"
	"nantty/modules/users/src/utils"
	"nantty/platform/httpserver"
)

const maximumCallbackBytes = 256 << 10
const callbackProcessingTimeout = 25 * time.Second

type IdentityVerificationController struct {
	Container *container.Container
}

func acceptAny[Request any](Request) error { return nil }

func (controller IdentityVerificationController) respond(writer http.ResponseWriter, request *http.Request, status int, result any, err error) {
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, status, result)
}

func (controller IdentityVerificationController) Journey(writer http.ResponseWriter, request *http.Request) {
	result, err := getverificationjourney.Handler{Container: controller.Container}.Execute(request.Context(), utils.AccountIdFromRequest(request))
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller IdentityVerificationController) Request(writer http.ResponseWriter, request *http.Request) {
	result, err := requestverification.Handler{Container: controller.Container}.Execute(request.Context(), requestverification.Command{AccountId: utils.AccountIdFromRequest(request)})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller IdentityVerificationController) StartCapture(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.StartCaptureRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := startidentitycapture.Handler{Container: controller.Container}.Execute(request.Context(), startidentitycapture.Command{
		AccountId: utils.AccountIdFromRequest(request), CaseId: request.PathValue("caseId"), ConsentVersion: body.ConsentVersion, ConsentAccepted: body.ConsentAccepted,
		Platform: body.Platform, VerificationMethod: body.VerificationMethod, VerificationProduct: body.VerificationProduct, DocumentCountry: body.DocumentCountry, DocumentType: body.DocumentType,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller IdentityVerificationController) CancelCapture(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, acceptAny[dtos.CancelCaptureRequest])
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := cancelidentitycapture.Handler{Container: controller.Container}.Execute(request.Context(), cancelidentitycapture.Command{
		AccountId: utils.AccountIdFromRequest(request), CaseId: request.PathValue("caseId"), CaptureAttemptID: body.CaptureAttemptID,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

func (controller IdentityVerificationController) ReplaySmileCallback(writer http.ResponseWriter, request *http.Request) {
	body, err := utils.DecodeAndValidate(writer, request, validateReplayCallbackRequest)
	if err != nil {
		controller.respond(writer, request, 0, nil, err)
		return
	}
	result, err := replaysmilecallback.Handler{Container: controller.Container}.Execute(request.Context(), replaysmilecallback.Command{
		Actor: utils.StaffActorFromRequest(request), CaseID: request.PathValue("caseId"), JobID: body.JobID, Reason: body.Reason,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}

var replayJobIDPattern = regexp.MustCompile(`^job_[0-9a-z]{26}$`)

func validateReplayCallbackRequest(body dtos.ReplayCallbackRequest) error {
	if !replayJobIDPattern.MatchString(body.JobID) {
		return httpserver.NewApiError(http.StatusBadRequest, "SMILE_REPLAY_JOB_ID_INVALID", "Enter a valid Smile ID job ID.")
	}
	return nil
}

func (controller IdentityVerificationController) DocumentTypes(writer http.ResponseWriter, request *http.Request) {
	country := strings.ToUpper(strings.TrimSpace(request.URL.Query().Get("country")))
	if country != "" && (len(country) != 2 || country[0] < 'A' || country[0] > 'Z' || country[1] < 'A' || country[1] > 'Z') {
		controller.respond(writer, request, 0, nil, httpserver.NewApiError(http.StatusBadRequest, "IDENTITY_COUNTRY_INVALID", "Choose a valid two-letter country code."))
		return
	}
	if controller.Container.IdentityCapture == nil {
		controller.respond(writer, request, 0, nil, httpserver.NewApiError(http.StatusServiceUnavailable, "IDENTITY_CATALOG_UNAVAILABLE", "Identity verification options are temporarily unavailable."))
		return
	}
	settings := controller.Container.Settings.Verification
	documentEnabled := services.SmileProductEnabled(settings.SmileIdEnabledProducts, "document_verification")
	enhancedDocumentEnabled := services.SmileProductEnabled(settings.SmileIdEnabledProducts, "enhanced_document_verification") && len(settings.SmileIdEnabledEnhancedDocumentTypes) > 0
	idNumberEnabled := services.SmileProductEnabled(settings.SmileIdEnabledProducts, "enhanced_kyc") && len(settings.SmileIdEnabledIdNumberTypes) > 0
	enhancedEntitlementsStatus := "not_configured"
	documentTypes := make([]integrations.SmileIdDocumentType, 0)
	enhancedDocumentTypes := make([]integrations.SmileIdDocumentType, 0)
	idNumberTypes := make([]integrations.SmileIdSupportedKycType, 0)
	var documents []integrations.SmileIdDocumentCountry
	var err error
	if documentEnabled || enhancedDocumentEnabled {
		documents, err = controller.Container.IdentityCapture.SupportedDocuments(request.Context(), country)
		if err != nil {
			controller.respond(writer, request, 0, nil, catalogError(err))
			return
		}
	}
	var enhancedEntitlements map[string][]string
	if enhancedDocumentEnabled {
		enhancedEntitlementsStatus = "unavailable"
		enhancedEntitlements, err = controller.Container.IdentityCapture.EnhancedDocumentEntitlements(request.Context())
		if err == nil {
			enhancedEntitlementsStatus = "available"
		}
	}
	var kycTypes []integrations.SmileIdSupportedKycType
	if idNumberEnabled {
		kycTypes, err = controller.Container.IdentityCapture.SupportedKycTypes(request.Context(), country)
		if err != nil {
			controller.respond(writer, request, 0, nil, catalogError(err))
			return
		}
	}
	if documentEnabled || enhancedDocumentEnabled {
		for _, supportedCountry := range documents {
			if country != "" && supportedCountry.Country.Code != country {
				continue
			}
			for _, idType := range supportedCountry.IDTypes {
				idTypeCode := strings.ToUpper(idType.Code)
				if documentEnabled && services.SmileDocumentTypeAllowed(settings.SmileIdEnabledDocumentTypes, supportedCountry.Country.Code, idTypeCode) {
					documentTypes = append(documentTypes, idType)
				}
				if enhancedDocumentEnabled && enhancedEntitlementsStatus == "available" && services.SmileIdTypeEnabled(settings.SmileIdEnabledEnhancedDocumentTypes, supportedCountry.Country.Code, idTypeCode) && smileIdEntitlementAllows(enhancedEntitlements, supportedCountry.Country.Code, idTypeCode) {
					enhancedDocumentTypes = append(enhancedDocumentTypes, idType)
				}
			}
		}
	}
	if idNumberEnabled {
		for _, idType := range kycTypes {
			if services.IsPersonalIdentityNumberType(idType) &&
				services.SmileIdTypeEnabled(settings.SmileIdEnabledIdNumberTypes, strings.ToUpper(idType.Country), strings.ToUpper(idType.Type)) &&
				(country == "" || strings.EqualFold(idType.Country, country)) {
				idNumberTypes = append(idNumberTypes, idType)
			}
		}
	}
	if country == "" {
		countries := make([]map[string]string, 0)
		countryCodes := make(map[string]bool)
		countryNames := make(map[string]string)
		for _, supportedCountry := range documents {
			countryNames[supportedCountry.Country.Code] = supportedCountry.Country.Name
		}
		addCountry := func(code string) {
			code = strings.ToUpper(code)
			if len(code) != 2 || code[0] < 'A' || code[0] > 'Z' || code[1] < 'A' || code[1] > 'Z' || countryCodes[code] {
				return
			}
			name := countryNames[code]
			if name == "" {
				name = services.CountryNameFromCode(code)
			}
			countryCodes[code] = true
			countries = append(countries, map[string]string{"code": code, "name": name})
		}
		if documentEnabled || enhancedDocumentEnabled {
			for _, supportedCountry := range documents {
				countryWildcardEnabled := documentEnabled && len(settings.SmileIdEnabledDocumentTypes) == 0
				countryWildcardEnabled = countryWildcardEnabled || (enhancedDocumentEnabled && enhancedEntitlementsStatus == "available" && services.SmileIdTypeEnabled(settings.SmileIdEnabledEnhancedDocumentTypes, supportedCountry.Country.Code, "") && len(enhancedEntitlements[strings.ToUpper(supportedCountry.Country.Code)]) > 0)
				if countryWildcardEnabled {
					addCountry(supportedCountry.Country.Code)
					continue
				}
				for _, idType := range supportedCountry.IDTypes {
					idTypeCode := strings.ToUpper(idType.Code)
					documentTypeEnabled := documentEnabled && services.SmileDocumentTypeAllowed(settings.SmileIdEnabledDocumentTypes, supportedCountry.Country.Code, idTypeCode)
					enhancedTypeEnabled := enhancedDocumentEnabled && enhancedEntitlementsStatus == "available" && services.SmileIdTypeEnabled(settings.SmileIdEnabledEnhancedDocumentTypes, supportedCountry.Country.Code, idTypeCode) && smileIdEntitlementAllows(enhancedEntitlements, supportedCountry.Country.Code, idTypeCode)
					if documentTypeEnabled || enhancedTypeEnabled {
						addCountry(supportedCountry.Country.Code)
						break
					}
				}
			}
		}
		for _, idType := range idNumberTypes {
			addCountry(idType.Country)
		}
		controller.respond(writer, request, http.StatusOK, map[string]any{"countries": countries, "availability": map[string]bool{"documentVerification": len(documentTypes) > 0, "enhancedDocumentVerification": len(enhancedDocumentTypes) > 0, "idNumberVerification": len(idNumberTypes) > 0}, "enhancedDocumentEntitlementStatus": enhancedEntitlementsStatus}, nil)
		return
	}
	controller.respond(writer, request, http.StatusOK, map[string]any{"country": country, "documentTypes": documentTypes, "enhancedDocumentTypes": enhancedDocumentTypes, "idNumberTypes": idNumberTypes, "availability": map[string]bool{"documentVerification": len(documentTypes) > 0, "enhancedDocumentVerification": len(enhancedDocumentTypes) > 0, "idNumberVerification": len(idNumberTypes) > 0}, "enhancedDocumentEntitlementStatus": enhancedEntitlementsStatus}, nil)
}

func smileIdEntitlementAllows(entitlements map[string][]string, country, idType string) bool {
	for _, enabledType := range entitlements[strings.ToUpper(country)] {
		if strings.EqualFold(enabledType, idType) {
			return true
		}
	}
	return false
}

func catalogError(err error) error {
	if err == nil {
		return nil
	}
	return httpserver.NewApiError(http.StatusServiceUnavailable, "IDENTITY_CATALOG_UNAVAILABLE", "Identity verification options are temporarily unavailable.")
}

func (controller IdentityVerificationController) SmileCallback(writer http.ResponseWriter, request *http.Request) {
	callbackContext, cancel := context.WithTimeout(request.Context(), callbackProcessingTimeout)
	defer cancel()
	settings := controller.Container.Settings.Verification
	signature := request.Header.Get("Response-Signature")
	timestamp := request.Header.Get("Response-Timestamp")
	jobId := request.Header.Get("smileid-job-id")
	userId := request.Header.Get("user-id")
	if signature != "" || timestamp != "" || jobId != "" || userId != "" {
		if !integrations.VerifySmileIdSignature(settings.SmileIdApiKey, settings.SmileIdPartnerId, timestamp, signature) || !services.SmileCallbackTimestampIsFresh(timestamp, controller.Container.Now()) {
			controller.respond(writer, request, 0, nil, applysmileresult.ErrCallbackSignatureInvalid)
			return
		}
	}
	raw, err := io.ReadAll(http.MaxBytesReader(writer, request.Body, maximumCallbackBytes))
	if err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			controller.respond(writer, request, 0, nil, httpserver.NewApiError(http.StatusRequestEntityTooLarge, "CALLBACK_TOO_LARGE", "The callback body is too large."))
			return
		}
		controller.respond(writer, request, 0, nil, applysmileresult.ErrCallbackMalformed)
		return
	}
	verify := func(timestamp, signature string) bool {
		return integrations.VerifySmileIdSignature(settings.SmileIdApiKey, settings.SmileIdPartnerId, timestamp, signature)
	}
	result, err := applysmileresult.Handler{Container: controller.Container, Verify: verify}.Execute(callbackContext, applysmileresult.Command{
		RawBody: raw, Signature: signature, Timestamp: timestamp, JobId: jobId, UserId: userId,
	})
	controller.respond(writer, request, http.StatusOK, result, err)
}
