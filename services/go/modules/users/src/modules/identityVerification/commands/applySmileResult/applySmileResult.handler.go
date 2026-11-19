package applysmileresult

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/verificationcase"
	checkmarkservices "nantty/modules/users/src/modules/checkmarks/services"
	verificationevents "nantty/modules/users/src/modules/identityVerification/events"
	"nantty/modules/users/src/modules/identityVerification/services"
	usersservices "nantty/modules/users/src/services"
	"nantty/platform/httpserver"
)

var (
	ErrCallbackSignatureInvalid = httpserver.NewApiError(http.StatusUnauthorized, "SIGNATURE_INVALID", "The callback signature is not valid.")
	ErrCallbackMalformed        = httpserver.NewApiError(http.StatusBadRequest, "CALLBACK_MALFORMED", "The callback body could not be read.")
)

type Handler struct {
	Container *container.Container
	Verify    func(timestamp, signature string) bool
}

type evaluation struct {
	nameScore     float64
	trust         int
	trustBlocked  bool
	goldApproved  bool
	accountActive bool
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	var envelope services.SmileCallbackEnvelope
	var err error
	if command.Signature != "" || command.Timestamp != "" || command.JobId != "" || command.UserId != "" {
		if handler.Verify == nil || !handler.Verify(command.Timestamp, command.Signature) || !services.SmileCallbackTimestampIsFresh(command.Timestamp, handler.Container.Now()) {
			return Result{}, ErrCallbackSignatureInvalid
		}
		envelope, err = services.ParseSmileIdV3Callback(command.RawBody, command.JobId, command.UserId)
	} else {
		envelope, err = services.ParseSmileIdCallback(command.RawBody)
		if err == nil && (handler.Verify == nil || !handler.Verify(envelope.Timestamp, envelope.Signature) || !envelope.IsFresh(handler.Container.Now())) {
			return Result{}, ErrCallbackSignatureInvalid
		}
	}
	if err != nil {
		return Result{}, ErrCallbackMalformed
	}
	var row *ent.VerificationCase
	if envelope.IsV3 {
		caseId, parseErr := uuid.Parse(envelope.CaseId)
		if envelope.CaseId != "" && (parseErr != nil || caseId == uuid.Nil) {
			return Result{}, ErrCallbackMalformed
		}
		if envelope.CaseId != "" {
			row, err = handler.Container.Client.VerificationCase.Query().Where(verificationcase.ID(caseId)).Only(ctx)
		} else {
			row, err = handler.Container.Client.VerificationCase.Query().Where(verificationcase.SmileUserID(envelope.UserId)).Only(ctx)
		}
	} else {
		row, err = handler.Container.Client.VerificationCase.Query().Where(verificationcase.SmileJobID(envelope.JobId)).Only(ctx)
	}
	if ent.IsNotFound(err) {
		return Result{Outcome: OutcomeIgnored}, nil
	}
	if err != nil {
		return Result{}, err
	}
	if envelope.IsV3 {
		if envelope.UserId == "" || !strings.EqualFold(envelope.Product, row.SmileProduct) || (envelope.CaseId != "" && !strings.EqualFold(envelope.CaseId, row.ID.String())) {
			return Result{}, ErrCallbackSignatureInvalid
		}
		if awaitingResult(row.Status) && !services.CaptureAttemptCallbackMatches(row.SmileJobID, row.ID.String(), envelope.CaptureAttemptID, envelope.UserId, row.SmileUserID) {
			if isCompletedRetryableCallback(row, envelope) {
				return Result{Outcome: OutcomeReplayed}, handler.Container.Client.VerificationCase.UpdateOneID(row.ID).AddCallbackCount(1).Exec(ctx)
			}
			return Result{}, ErrCallbackSignatureInvalid
		}
		if !awaitingResult(row.Status) && row.SmileUserID != nil && envelope.UserId != *row.SmileUserID {
			return Result{}, ErrCallbackSignatureInvalid
		}
	} else if !envelope.BelongsTo(row.AccountID.String()) {
		return Result{}, ErrCallbackSignatureInvalid
	}
	if !awaitingResult(row.Status) {
		if envelope.IsV3 && (row.SmileJobID == nil || *row.SmileJobID != envelope.Result.SmileJobId) {
			return Result{Outcome: OutcomeIgnored}, nil
		}
		return Result{Outcome: OutcomeReplayed}, handler.Container.Client.VerificationCase.UpdateOneID(row.ID).AddCallbackCount(1).Exec(ctx)
	}
	if envelope.IsV3 && envelope.Result.ResultCode == "error" && services.IsRetryableSmileProviderError(envelope.Product, envelope.Result.ProviderReasonCode) {
		return handler.markCaptureRetryable(ctx, row, envelope)
	}
	evaluated, err := handler.evaluate(ctx, row, envelope)
	if err != nil {
		return Result{}, err
	}
	fingerprint := envelope.DocumentFingerprintFor(handler.Container.Settings.Verification.DocumentFingerprintKey, row.DocumentCountry, row.DocumentType)
	outcome := OutcomeReplayed
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := tx.VerificationCase.Query().Where(verificationcase.ID(row.ID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if !awaitingResult(locked.Status) {
			if envelope.IsV3 && (locked.SmileJobID == nil || *locked.SmileJobID != envelope.Result.SmileJobId) {
				outcome = OutcomeIgnored
				return nil
			}
			return locked.Update().AddCallbackCount(1).Exec(ctx)
		}
		if envelope.IsV3 && !strings.EqualFold(envelope.Product, locked.SmileProduct) {
			return ErrCallbackSignatureInvalid
		}
		if envelope.IsV3 && !services.CaptureAttemptCallbackMatches(locked.SmileJobID, locked.ID.String(), envelope.CaptureAttemptID, envelope.UserId, locked.SmileUserID) {
			return ErrCallbackSignatureInvalid
		}
		reused := false
		if fingerprint != "" {
			if reused, err = tx.VerificationCase.Query().Where(verificationcase.DocumentFingerprint(fingerprint), verificationcase.AccountIDNEQ(locked.AccountID),
				verificationcase.StatusIn(verificationcase.StatusApproved, verificationcase.StatusUnderReview, verificationcase.StatusProcessing)).Exist(ctx); err != nil {
				return err
			}
		}
		result := envelope.Result
		if !services.SmileResultMatchesSelection(result, locked.DocumentCountry, locked.DocumentType) {
			result.SelectedIdentityMismatch = true
		}
		decision := services.DecideVerificationCase(services.AutoDecisionInput{
			Result: result, Product: envelope.Product, NameMatchScore: evaluated.nameScore, TrustScore: evaluated.trust, TrustBlocked: evaluated.trustBlocked || !evaluated.accountActive,
			EligibleAtPayment: locked.EligibleAtPayment, DocumentReusedByPeer: reused, GoldBusinessApproved: evaluated.goldApproved, IsGold: locked.Color == verificationcase.ColorGold,
		})
		update := locked.Update().AddCallbackCount(1).SetSmileReference(result.SmileJobId).SetSmileResultCode(result.ResultCode).
			SetLivenessResult(result.Liveness).SetDocumentResult(result.Document).SetFaceMatchResult(result.FaceMatch).SetDatabaseResult(result.DatabaseLookup).
			SetFaceMatchConfidence(result.FaceMatchConfidence).SetNameMatchScore(evaluated.nameScore).SetTrustScore(evaluated.trust).
			SetDocumentFingerprint(fingerprint).SetDecisionReasons(decision.Reasons).SetFraudSignals(decision.FraudSignals)
		if envelope.IsV3 {
			update.SetSmileJobID(result.SmileJobId)
		}
		now := handler.Container.Now()
		if decision.Approve {
			updated, err := update.Save(ctx)
			if err != nil {
				return err
			}
			outcome = OutcomeApproved
			_, err = services.ApproveCaseInTransaction(ctx, tx, now, updated, "Automatic check", "All identity checks passed", true)
			return err
		}
		updated, err := update.SetStatus(verificationcase.StatusUnderReview).Save(ctx)
		if err != nil {
			return err
		}
		outcome = OutcomeUnderReview
		if len(decision.FraudSignals) > 0 {
			if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, verificationevents.VerificationFraudSignalDetectedType, updated.AccountID.String(), now, verificationevents.FraudSignalData{
				SuggestionId: "verification:" + updated.ID.String(), AccountId: updated.AccountID.String(), CaseId: updated.ID.String(), Signals: decision.FraudSignals,
				RiskScore: min(100, 40+20*len(decision.FraudSignals)), AdvisoryOnly: true,
			}); err != nil {
				return err
			}
		}
		return services.SendCaseToReviewInTransaction(ctx, tx, now, updated)
	})
	return Result{Outcome: outcome}, err
}

func (handler Handler) markCaptureRetryable(ctx context.Context, row *ent.VerificationCase, envelope services.SmileCallbackEnvelope) (Result, error) {
	updated := false
	replayed := false
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := tx.VerificationCase.Query().Where(verificationcase.ID(row.ID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if !awaitingResult(locked.Status) {
			if isCompletedRetryableCallback(locked, envelope) {
				replayed = true
				return locked.Update().AddCallbackCount(1).Exec(ctx)
			}
			return ErrCallbackSignatureInvalid
		}
		if !services.CaptureAttemptCallbackMatches(locked.SmileJobID, locked.ID.String(), envelope.CaptureAttemptID, envelope.UserId, locked.SmileUserID) {
			return ErrCallbackSignatureInvalid
		}
		reason := "retryable_provider_error_" + envelope.Result.ProviderReasonCode
		_, err = locked.Update().AddCallbackCount(1).SetSmileReference(envelope.Result.SmileJobId).SetSmileResultCode("error").
			SetLivenessResult(services.CheckNotDone).SetDocumentResult(services.CheckNotDone).SetFaceMatchResult(services.CheckNotDone).SetDatabaseResult(services.CheckNotDone).
			SetDecisionReasons([]string{reason}).SetFraudSignals([]string{}).SetStatus(verificationcase.StatusAwaitingCapture).
			ClearSmileJobID().ClearSmileUserID().Save(ctx)
		updated = err == nil
		return err
	})
	if err != nil {
		return Result{}, err
	}
	if replayed {
		return Result{Outcome: OutcomeReplayed}, nil
	}
	if !updated {
		return Result{Outcome: OutcomeIgnored}, nil
	}
	return Result{Outcome: OutcomeRetryable}, nil
}

func isCompletedRetryableCallback(row *ent.VerificationCase, envelope services.SmileCallbackEnvelope) bool {
	return row.Status == verificationcase.StatusAwaitingCapture && row.SmileJobID == nil && row.SmileReference == envelope.Result.SmileJobId &&
		envelope.Result.ResultCode == "error" && services.IsRetryableSmileProviderError(envelope.Product, envelope.Result.ProviderReasonCode)
}

func (handler Handler) evaluate(ctx context.Context, row *ent.VerificationCase, envelope services.SmileCallbackEnvelope) (evaluation, error) {
	profile, err := handler.Container.Client.Profile.Get(ctx, row.ProfileID)
	if err != nil {
		return evaluation{}, err
	}
	account, err := usersservices.LoadActiveAccountSummary(ctx, row.AccountID)
	if err != nil {
		return evaluation{}, err
	}
	personal, _, err := usersservices.EnsurePersonalProfile(ctx, handler.Container, row.AccountID)
	if err != nil {
		return evaluation{}, err
	}
	result := evaluation{accountActive: account.Active, nameScore: services.ScoreNameMatch(envelope.FullName, account.Name, personal.DisplayName, profileNameFor(profile, row))}
	signals, err := services.BuildEligibilitySignals(ctx, handler.Container, profile, account, string(row.Color))
	if err != nil {
		return evaluation{}, err
	}
	assessment := services.AssessVerificationEligibility(ctx, handler.Container, signals)
	result.trust, result.trustBlocked = assessment.TrustScore, assessment.Tier == services.TierBlocked
	if row.Color == verificationcase.ColorGold {
		if result.goldApproved, err = checkmarkservices.BusinessDocumentsAllApproved(ctx, handler.Container, row.AccountID); err != nil {
			return evaluation{}, err
		}
	}
	return result, nil
}

func profileNameFor(profile *ent.Profile, row *ent.VerificationCase) string {
	if row.Color == verificationcase.ColorGold {
		return ""
	}
	return profile.DisplayName
}

func awaitingResult(status verificationcase.Status) bool {
	return status == verificationcase.StatusAwaitingCapture || status == verificationcase.StatusProcessing || status == verificationcase.StatusAwaitingConsent
}
