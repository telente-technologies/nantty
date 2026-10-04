package startidentitycapture

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/verificationcase"
	"zudomart/modules/users/src/integrations"
	"zudomart/modules/users/src/modules/identityVerification/services"
	"zudomart/platform/httpserver"
)

var ErrCaptureUnavailable = httpserver.NewApiError(http.StatusServiceUnavailable, "IDENTITY_CHECK_UNAVAILABLE", "The identity check is not available right now. Try again in a few minutes.")

type Handler struct {
	Container *container.Container
}

// Execute records the explicit biometric consent and only then opens a Smile ID capture session: the web gets a
// token for Smile's hosted web integration, the apps get a single-use Smile Link to open in a WebView.
func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	settings := handler.Container.Settings.Verification
	if !command.ConsentAccepted || command.ConsentVersion != settings.ConsentVersion {
		return Result{}, usersErrors.ValidationFailedFor("consentAccepted", "Read and accept the current biometric consent before the selfie and ID capture.")
	}
	country, documentType := strings.ToUpper(command.DocumentCountry), strings.ToUpper(command.DocumentType)
	product, supported := services.SmileProductFor(country, documentType)
	if !supported {
		return Result{}, usersErrors.ValidationFailedFor("documentType", "Choose a supported photo ID for that country.")
	}
	accountId, _ := uuid.Parse(command.AccountId)
	caseId, err := uuid.Parse(command.CaseId)
	if err != nil {
		return Result{}, usersErrors.NotFound("That verification was not found.")
	}
	if handler.Container.IdentityCapture == nil {
		return Result{}, ErrCaptureUnavailable
	}
	jobId := uuid.Must(uuid.NewV7()).String()
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
			return usersErrors.Conflict("CAPTURE_NOT_ALLOWED", "This verification is no longer waiting for a selfie and ID.")
		}
		row, err = row.Update().SetConsentVersion(command.ConsentVersion).SetConsentAt(handler.Container.Now()).SetSmileJobID(jobId).SetSmileProduct(product).
			SetDocumentCountry(country).SetDocumentType(documentType).SetStatus(verificationcase.StatusAwaitingCapture).Save(ctx)
		return err
	})
	if err != nil {
		return Result{}, err
	}
	result := Result{Product: product, JobId: jobId, UserId: row.AccountID.String(), PartnerId: settings.SmileIdPartnerId, Environment: settings.SmileIdEnvironment, CallbackUrl: settings.SmileIdCallbackUrl}
	if command.Platform == "web" {
		result.Mode = "web_integration"
		result.Token, err = handler.Container.IdentityCapture.CreateWebToken(ctx, result.UserId, jobId, product)
	} else {
		result.Mode = "hosted_link"
		result.Url, err = handler.Container.IdentityCapture.CreateSmileLink(ctx, integrations.SmileLinkRequest{
			UserId: result.UserId, JobId: jobId, Name: "Zudomart checkmark verification", CompanyName: "Zudomart", PrivacyPolicyUrl: settings.PrivacyPolicyUrl,
			IdTypes:   []integrations.SmileIdIdType{{Country: country, IdType: documentType, VerificationMethod: product}},
			ExpiresAt: handler.Container.Now().Add(time.Hour),
		})
	}
	if err != nil {
		handler.Container.Logger.WarnContext(ctx, "smile id capture session failed", "caseId", row.ID.String(), "error", err.Error())
		return Result{}, ErrCaptureUnavailable
	}
	return result, nil
}
