package applysmileresult

import (
	"context"
	"net/http"

	"zudomart/modules/users/src/container"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/verificationcase"
	checkmarkservices "zudomart/modules/users/src/modules/checkmarks/services"
	verificationevents "zudomart/modules/users/src/modules/identityVerification/events"
	"zudomart/modules/users/src/modules/identityVerification/services"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/platform/httpserver"
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
	envelope, err := services.ParseSmileIdCallback(command.RawBody)
	if err != nil {
		return Result{}, ErrCallbackMalformed
	}
	if handler.Verify == nil || !handler.Verify(envelope.Timestamp, envelope.Signature) {
		return Result{}, ErrCallbackSignatureInvalid
	}
	row, err := handler.Container.Client.VerificationCase.Query().Where(verificationcase.SmileJobID(envelope.JobId)).Only(ctx)
	if ent.IsNotFound(err) {
		return Result{Outcome: OutcomeIgnored}, nil
	}
	if err != nil {
		return Result{}, err
	}
	if !awaitingResult(row.Status) {
		return Result{Outcome: OutcomeReplayed}, handler.Container.Client.VerificationCase.UpdateOneID(row.ID).AddCallbackCount(1).Exec(ctx)
	}
	evaluated, err := handler.evaluate(ctx, row, envelope)
	if err != nil {
		return Result{}, err
	}
	fingerprint := envelope.DocumentFingerprint(handler.Container.Settings.Verification.DocumentFingerprintKey)
	outcome := OutcomeReplayed
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := tx.VerificationCase.Query().Where(verificationcase.ID(row.ID)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if !awaitingResult(locked.Status) {
			return locked.Update().AddCallbackCount(1).Exec(ctx)
		}
		reused := false
		if fingerprint != "" {
			if reused, err = tx.VerificationCase.Query().Where(verificationcase.DocumentFingerprint(fingerprint), verificationcase.AccountIDNEQ(locked.AccountID),
				verificationcase.StatusIn(verificationcase.StatusApproved, verificationcase.StatusUnderReview, verificationcase.StatusProcessing)).Exist(ctx); err != nil {
				return err
			}
		}
		decision := services.DecideVerificationCase(services.AutoDecisionInput{
			Result: envelope.Result, NameMatchScore: evaluated.nameScore, TrustScore: evaluated.trust, TrustBlocked: evaluated.trustBlocked || !evaluated.accountActive,
			EligibleAtPayment: locked.EligibleAtPayment, DocumentReusedByPeer: reused, GoldBusinessApproved: evaluated.goldApproved, IsGold: locked.Color == verificationcase.ColorGold,
		})
		result := envelope.Result
		update := locked.Update().AddCallbackCount(1).SetSmileReference(result.SmileJobId).SetSmileResultCode(result.ResultCode).
			SetLivenessResult(result.Liveness).SetDocumentResult(result.Document).SetFaceMatchResult(result.FaceMatch).SetDatabaseResult(result.DatabaseLookup).
			SetFaceMatchConfidence(result.FaceMatchConfidence).SetNameMatchScore(evaluated.nameScore).SetTrustScore(evaluated.trust).
			SetDocumentFingerprint(fingerprint).SetDecisionReasons(decision.Reasons).SetFraudSignals(decision.FraudSignals)
		if result.DocumentType != "" {
			update.SetDocumentType(result.DocumentType)
		}
		if result.DocumentCountry != "" {
			update.SetDocumentCountry(result.DocumentCountry)
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
