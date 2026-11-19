package cancelidentitycapture

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/verificationcase"
	"nantty/modules/users/src/modules/identityVerification/services"
	"nantty/platform/httpserver"
)

var ErrCaptureCancellationNotAllowed = httpserver.NewApiError(http.StatusConflict, "CAPTURE_CANCELLATION_NOT_ALLOWED", "This identity check can no longer be cancelled from this screen.")

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	accountID, accountErr := uuid.Parse(command.AccountId)
	caseID, caseErr := uuid.Parse(command.CaseId)
	attemptID, attemptErr := uuid.Parse(command.CaptureAttemptID)
	if accountErr != nil || caseErr != nil || attemptErr != nil {
		return Result{}, ErrCaptureCancellationNotAllowed
	}

	cancelled := false
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.VerificationCase.Query().Where(verificationcase.ID(caseID), verificationcase.AccountID(accountID)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return httpserver.NewApiError(http.StatusNotFound, "VERIFICATION_NOT_FOUND", "That verification was not found.")
		}
		if err != nil {
			return err
		}
		if !services.WebPhotoDocumentCaptureCanCancel(string(row.Status), row.SmileProduct, row.SmileJobID, row.ID.String(), attemptID.String()) {
			return ErrCaptureCancellationNotAllowed
		}
		if err := row.Update().SetStatus(verificationcase.StatusAwaitingConsent).ClearSmileJobID().ClearSmileUserID().ClearConsentAt().Exec(ctx); err != nil {
			return err
		}
		cancelled = true
		return nil
	})
	if err != nil {
		return Result{}, err
	}
	return Result{Cancelled: cancelled}, nil
}
