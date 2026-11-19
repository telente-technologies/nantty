package startidentitycapture

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/verificationcase"
	"nantty/modules/users/src/integrations"
	"nantty/modules/users/src/modules/identityVerification/services"
	"nantty/platform/httpserver"
)

var ErrCaptureUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "IDENTITY_CHECK_UNAVAILABLE", "The identity check is not available right now. Try again in a few minutes.")
var ErrCaptureAlreadyStarted = httpserver.NewApiError(http.StatusConflict, "CAPTURE_ALREADY_STARTED", "This identity check has already been opened. Return to it or contact support if it did not load.")

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	settings := handler.Container.Settings.Verification
	if !command.ConsentAccepted || command.ConsentVersion != settings.ConsentVersion {
		return Result{}, usersErrors.ValidationFailedFor("consentAccepted", "Read and accept the current identity-verification consent before continuing.")
	}
	country, documentType := strings.ToUpper(command.DocumentCountry), strings.ToUpper(command.DocumentType)
	method := command.VerificationMethod
	if method == "" {
		method = services.VerificationMethodDocument
	}
	product, supported := services.SmileProductForSelection(method, country, documentType, command.VerificationProduct)
	if !supported {
		return Result{}, usersErrors.ValidationFailedFor("documentType", "Choose a supported identity document or number for that country.")
	}
	if !services.SmileProductEnabled(settings.SmileIdEnabledProducts, product) {
		return Result{}, ErrCaptureUnavailable
	}
	if method == services.VerificationMethodDocument && product == "document_verification" && !services.SmileDocumentTypeAllowed(settings.SmileIdEnabledDocumentTypes, country, documentType) {
		return Result{}, ErrCaptureUnavailable
	}
	if product == "enhanced_document_verification" && !services.SmileIdTypeEnabled(settings.SmileIdEnabledEnhancedDocumentTypes, country, documentType) {
		return Result{}, ErrCaptureUnavailable
	}
	if method == services.VerificationMethodIdNumber && !services.SmileIdTypeEnabled(settings.SmileIdEnabledIdNumberTypes, country, documentType) {
		return Result{}, ErrCaptureUnavailable
	}
	accountId, _ := uuid.Parse(command.AccountId)
	caseId, err := uuid.Parse(command.CaseId)
	if err != nil {
		return Result{}, usersErrors.NotFound("That verification was not found.")
	}
	if command.Platform != "web" && command.Platform != "android" && command.Platform != "ios" {
		return Result{}, usersErrors.ValidationFailedFor("platform", "Choose a supported identity verification platform.")
	}
	existing, err := handler.Container.Client.VerificationCase.Query().Where(verificationcase.ID(caseId), verificationcase.AccountID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return Result{}, usersErrors.NotFound("That verification was not found.")
	}
	if err != nil {
		return Result{}, err
	}
	if existing.Status != verificationcase.StatusAwaitingConsent && existing.Status != verificationcase.StatusAwaitingCapture {
		return Result{}, usersErrors.Conflict("CAPTURE_NOT_ALLOWED", "This verification is no longer waiting for identity verification.")
	}
	now := handler.Container.Now()
	if !services.CaptureMarkerCanRetry(string(existing.Status), existing.SmileJobID, existing.ConsentAt, now) {
		return Result{}, ErrCaptureAlreadyStarted
	}
	if handler.Container.IdentityCapture == nil {
		return Result{}, ErrCaptureUnavailable
	}
	supported, catalogErr := handler.supportedCapture(ctx, method, product, country, documentType)
	if catalogErr != nil {
		return Result{}, ErrCaptureUnavailable
	}
	if !supported {
		return Result{}, usersErrors.ValidationFailedFor("documentType", "Choose an identity option supported for that country.")
	}
	consentAt := now
	attemptID := uuid.NewString()
	attemptMarker := services.CaptureAttemptMarker(caseId.String(), attemptID)
	smileUserID := integrations.SmileIdUserIDForCaptureAttempt(attemptID)
	var row *ent.VerificationCase
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err = tx.VerificationCase.Query().Where(verificationcase.ID(caseId), verificationcase.AccountID(accountId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return usersErrors.NotFound("That verification was not found.")
		}
		if err != nil {
			return err
		}
		if row.Status != verificationcase.StatusAwaitingConsent && row.Status != verificationcase.StatusAwaitingCapture {
			return usersErrors.Conflict("CAPTURE_NOT_ALLOWED", "This verification is no longer waiting for an identity check.")
		}
		if !services.CaptureMarkerCanRetry(string(row.Status), row.SmileJobID, row.ConsentAt, now) {
			return ErrCaptureAlreadyStarted
		}
		row, err = row.Update().SetConsentVersion(command.ConsentVersion).SetConsentAt(consentAt).SetSmileJobID(attemptMarker).SetSmileUserID(smileUserID).SetSmileProduct(product).
			SetSmileResultCode("").SetDecisionReasons([]string{}).
			SetDocumentCountry(country).SetDocumentType(documentType).SetStatus(verificationcase.StatusAwaitingCapture).Save(ctx)
		return err
	})
	if err != nil {
		return Result{}, err
	}
	capture := integrations.SmileIdCaptureRequest{
		CaseId: row.ID.String(), CaptureAttemptID: attemptID, Product: product, Country: country, DocumentType: documentType,
		ConsentAt: consentAt, PrivacyPolicyUrl: settings.PrivacyPolicyUrl, ExpiresAt: consentAt.Add(time.Hour),
	}
	result := Result{Product: product, CaseId: row.ID.String(), CaptureAttemptID: attemptID, PartnerId: settings.SmileIdPartnerId, Environment: settings.SmileIdEnvironment}
	if command.Platform == "web" && method == services.VerificationMethodDocument {
		result.Mode = "web_integration"
		result.CallbackUrl = settings.SmileIdWebSdkCallbackUrl
		if result.CallbackUrl == "" {
			result.CallbackUrl = settings.SmileIdCallbackUrl
		}
		result.Token, err = handler.Container.IdentityCapture.CreateWebToken(ctx, capture)
	} else {
		result.Mode = "hosted_link"
		result.CallbackUrl = settings.SmileIdHostedLinkCallbackUrl
		if result.CallbackUrl == "" {
			result.CallbackUrl = settings.SmileIdCallbackUrl
		}
		capture.RedirectUrl = strings.TrimRight(settings.WebAppBaseUrl, "/") + "/verification/return"
		result.Url, err = handler.Container.IdentityCapture.CreateSmileLink(ctx, capture)
	}
	if err != nil {
		handler.Container.Logger.WarnContext(ctx, "smile id capture session failed", "caseId", row.ID.String(), "error", err.Error())
		if releaseErr := handler.releaseFailedCapture(ctx, row.ID, attemptMarker); releaseErr != nil {
			handler.Container.Logger.ErrorContext(ctx, "smile id failed capture marker could not be released", "caseId", row.ID.String(), "error", releaseErr.Error())
		}
		return Result{}, ErrCaptureUnavailable
	}
	return result, nil
}

func (handler Handler) releaseFailedCapture(ctx context.Context, caseID uuid.UUID, attemptMarker string) error {
	_, err := handler.Container.Client.VerificationCase.Update().
		Where(verificationcase.ID(caseID), verificationcase.StatusEQ(verificationcase.StatusAwaitingCapture), verificationcase.SmileJobIDEQ(attemptMarker)).
		ClearSmileJobID().ClearSmileUserID().Save(ctx)
	return err
}

func (handler Handler) supportedCapture(ctx context.Context, method, product, country, idType string) (bool, error) {
	if method == services.VerificationMethodIdNumber {
		types, err := handler.Container.IdentityCapture.SupportedKycTypes(ctx, country)
		if err != nil {
			return false, err
		}
		for _, supported := range types {
			if services.IsPersonalIdentityNumberType(supported) && strings.EqualFold(supported.Country, country) && strings.EqualFold(supported.Type, idType) {
				return true, nil
			}
		}
		return false, nil
	}
	if product == "enhanced_document_verification" {
		entitlements, err := handler.Container.IdentityCapture.EnhancedDocumentEntitlements(ctx)
		if err != nil {
			return false, err
		}
		allowed := false
		for _, enabledType := range entitlements[strings.ToUpper(country)] {
			if strings.EqualFold(enabledType, idType) {
				allowed = true
				break
			}
		}
		if !allowed {
			return false, nil
		}
	}
	documents, err := handler.Container.IdentityCapture.SupportedDocuments(ctx, country)
	if err != nil {
		return false, err
	}
	for _, countryDocuments := range documents {
		if countryDocuments.Country.Code != country {
			continue
		}
		for _, supported := range countryDocuments.IDTypes {
			if supported.Code == idType {
				return true, nil
			}
		}
	}
	return false, nil
}
