package replaysmilecallback

import (
	"context"
	"errors"
	"net/http"
	"regexp"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/verificationcase"
	"nantty/modules/users/src/integrations"
	"nantty/modules/users/src/modules/accountEnforcement/services"
	identityservices "nantty/modules/users/src/modules/identityVerification/services"
	usersservices "nantty/modules/users/src/services"
	"nantty/platform/httpserver"
)

var smileReplayJobID = regexp.MustCompile(`^job_[0-9a-z]{26}$`)

type callbackReplayer interface {
	ReplayCallback(ctx context.Context, product, captureAttemptID, jobID string) (integrations.SmileIdReplayResult, error)
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	if !command.Actor.StepUp || command.Actor.Id == "" {
		return Result{}, httpserver.NewApiError(http.StatusForbidden, "STEP_UP_REQUIRED", "Verify your identity again before replaying a provider callback.")
	}
	reason, err := services.RequireReason(command.Reason)
	if err != nil {
		return Result{}, err
	}
	caseID, err := uuid.Parse(command.CaseID)
	if err != nil || !smileReplayJobID.MatchString(command.JobID) {
		return Result{}, usersErrors.NotFound("That verification was not found.")
	}
	if handler.Container == nil || handler.Container.Client == nil || handler.Container.IdentityCapture == nil {
		return Result{}, httpserver.NewApiError(http.StatusServiceUnavailable, "SMILE_REPLAY_UNAVAILABLE", "Callback replay is temporarily unavailable.")
	}
	row, err := handler.Container.Client.VerificationCase.Query().Where(verificationcase.ID(caseID)).Only(ctx)
	if ent.IsNotFound(err) {
		return Result{}, usersErrors.NotFound("That verification was not found.")
	}
	if err != nil {
		return Result{}, err
	}
	if row.Status != verificationcase.StatusAwaitingCapture {
		return Result{}, usersErrors.Conflict("CALLBACK_REPLAY_NOT_ALLOWED", "Only a verification still awaiting its provider result can receive a callback replay.")
	}
	attemptID, ok := identityservices.CaptureAttemptIDForReplay(row.SmileJobID, row.ID)
	if !ok || (row.SmileProduct != "document_verification" && row.SmileProduct != "enhanced_document_verification" && row.SmileProduct != "enhanced_kyc") {
		return Result{}, usersErrors.Conflict("CALLBACK_REPLAY_NOT_ALLOWED", "This verification does not have a replayable Smile ID capture session.")
	}
	replayer, ok := handler.Container.IdentityCapture.(callbackReplayer)
	if !ok {
		return Result{}, httpserver.NewApiError(http.StatusServiceUnavailable, "SMILE_REPLAY_UNAVAILABLE", "Callback replay is temporarily unavailable.")
	}
	actor := command.Actor
	if err := usersservices.RecordStaffAuditEntry(ctx, actor, usersservices.StaffAuditEntry{
		Action: "identityVerification.callbackReplayRequested", SubjectType: "verification_case", SubjectId: row.ID.String(), SubjectLabel: row.AccountID.String(), Reason: reason,
		Before: map[string]any{"status": row.Status, "product": row.SmileProduct}, After: map[string]any{"jobId": command.JobID, "phase": "requested"},
	}); err != nil {
		return Result{}, err
	}
	replay, replayErr := replayer.ReplayCallback(ctx, row.SmileProduct, attemptID.String(), command.JobID)
	if replayErr == nil && (replay.Status != "accepted" || replay.JobID != command.JobID) {
		replayErr = errors.New("smile id replay response did not match the requested job")
	}
	after := map[string]any{"jobId": command.JobID, "phase": "failed"}
	if replayErr == nil {
		after["phase"] = "accepted"
	}
	auditErr := usersservices.RecordStaffAuditEntry(ctx, actor, usersservices.StaffAuditEntry{
		Action: "identityVerification.callbackReplayResult", SubjectType: "verification_case", SubjectId: row.ID.String(), SubjectLabel: row.AccountID.String(), Reason: reason,
		Before: map[string]any{"phase": "requested"}, After: after,
	})
	if auditErr != nil && handler.Container.Logger != nil {
		handler.Container.Logger.ErrorContext(ctx, "identity verification callback replay outcome could not be audited", "caseId", row.ID.String(), "jobId", command.JobID, "error", auditErr.Error())
	}
	if replayErr != nil {
		if auditErr != nil {
			return Result{}, auditErr
		}
		return Result{}, httpserver.NewApiError(http.StatusBadGateway, "SMILE_REPLAY_FAILED", "Smile ID did not accept the callback replay. Check the job state and try again if appropriate.")
	}
	if auditErr != nil {
		return Result{}, httpserver.NewApiError(http.StatusInternalServerError, "SMILE_REPLAY_AUDIT_FAILED", "Smile ID accepted the callback replay, but Nantty could not record its final audit status. Contact platform support before retrying.")
	}
	return Result{Accepted: replay.Status == "accepted", Message: "Smile ID accepted the callback replay. The verification updates only after Nantty receives and validates the callback."}, nil
}
