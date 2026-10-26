package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	"nantty/modules/users/src/generated/ent/verificationcase"
	"nantty/modules/users/src/generated/ent/verificationeligibility"
	checkmarkservices "nantty/modules/users/src/modules/checkmarks/services"
	verificationevents "nantty/modules/users/src/modules/identityVerification/events"
)

var refundablePlans = map[string]bool{"blue": true, "gold_only": true}

var checkmarkShareRefundPlans = map[string]bool{"seller_pro": true, "seller_business": true, "premium": true, "gold_combined": true}

const (
	RefundScopeFull           = "full"
	RefundScopeCheckmarkShare = "checkmark_share"
)

func RefundScopeFor(planCode string) string {
	if checkmarkShareRefundPlans[planCode] {
		return RefundScopeCheckmarkShare
	}
	return RefundScopeFull
}

func refundsOnRejection(planCode string) bool {
	return refundablePlans[planCode] || checkmarkShareRefundPlans[planCode]
}

type OpenCaseRequest struct {
	Profile        *ent.Profile
	Color          string
	SubscriptionId string
	PlanCode       string
	Channel        string
}

func IdentityAlreadyVerified(ctx context.Context, tx *ent.Tx, profileId uuid.UUID) (bool, error) {
	return tx.VerificationCase.Query().Where(verificationcase.ProfileID(profileId), verificationcase.StatusEQ(verificationcase.StatusApproved)).Exist(ctx)
}

func OpenVerificationCaseInTransaction(ctx context.Context, tx *ent.Tx, now time.Time, request OpenCaseRequest) (*ent.VerificationCase, error) {
	existing, err := tx.VerificationCase.Query().Where(verificationcase.SubscriptionID(request.SubscriptionId)).Only(ctx)
	if err == nil {
		return existing, nil
	}
	if !ent.IsNotFound(err) {
		return nil, err
	}
	eligibility, err := tx.VerificationEligibility.Query().Where(verificationeligibility.ProfileID(request.Profile.ID)).Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return nil, err
	}
	eligible := eligibility != nil && (eligibility.State == verificationeligibility.StateEligible || eligibility.Tier == verificationeligibility.TierBuyNow)
	created, err := tx.VerificationCase.Create().SetProfileID(request.Profile.ID).SetAccountID(request.Profile.AccountID).SetColor(verificationcase.Color(request.Color)).
		SetSubscriptionID(request.SubscriptionId).SetPlanCode(request.PlanCode).SetPaymentChannel(request.Channel).SetEligibleAtPayment(eligible).Save(ctx)
	if err != nil {
		return nil, err
	}
	return created, usersevents.EnqueueOutboxEventInTransaction(ctx, tx, verificationevents.VerificationCaseOpenedType, request.Profile.ID.String(), now, caseEventData(created, false, ""))
}

func ApproveCaseInTransaction(ctx context.Context, tx *ent.Tx, now time.Time, row *ent.VerificationCase, decidedBy, reason string, automatic bool) (*ent.VerificationCase, error) {
	profile, err := tx.Profile.Get(ctx, row.ProfileID)
	if err != nil {
		return nil, err
	}
	approved, err := row.Update().SetStatus(verificationcase.StatusApproved).SetDecidedAt(now).SetVerifiedAt(now).SetDecidedByName(decidedBy).SetDecisionReason(reason).Save(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := checkmarkservices.SetProfileCheckmarkInTransaction(ctx, tx, now, checkmarkservices.CheckmarkChange{
		Profile: profile, Color: profilecheckmark.Color(row.Color), Status: profilecheckmark.StatusVerified, Source: profilecheckmark.SourceSubscription, SourceId: &row.ID,
	}); err != nil {
		return nil, err
	}
	notice := NoticeFor(profile, string(row.Color))
	notice.CaseId, notice.VerifiedAt = row.ID.String(), now.UTC().Format(time.RFC3339)
	if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, verificationevents.VerificationApprovedNoticeType, profile.AccountID.String(), now, notice); err != nil {
		return nil, err
	}
	return approved, usersevents.EnqueueOutboxEventInTransaction(ctx, tx, verificationevents.VerificationCaseDecidedType, row.ProfileID.String(), now, caseEventData(approved, automatic, reason))
}

func SendCaseToReviewInTransaction(ctx context.Context, tx *ent.Tx, now time.Time, row *ent.VerificationCase) error {
	profile, err := tx.Profile.Get(ctx, row.ProfileID)
	if err != nil {
		return err
	}
	notice := NoticeFor(profile, string(row.Color))
	notice.CaseId, notice.ReviewWithin = row.ID.String(), 3
	return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, verificationevents.VerificationUnderReviewNoticeType, profile.AccountID.String(), now, notice)
}

func RejectCaseInTransaction(ctx context.Context, tx *ent.Tx, now time.Time, row *ent.VerificationCase, decidedBy, reason string) (*ent.VerificationCase, error) {
	profile, err := tx.Profile.Get(ctx, row.ProfileID)
	if err != nil {
		return nil, err
	}
	refund := verificationcase.RefundStatusNotApplicable
	if refundsOnRejection(row.PlanCode) {
		refund = verificationcase.RefundStatusRequested
	}
	rejected, err := row.Update().SetStatus(verificationcase.StatusRejected).SetRefundStatus(refund).SetDecidedAt(now).SetDecidedByName(decidedBy).SetDecisionReason(reason).Save(ctx)
	if err != nil {
		return nil, err
	}
	if refund == verificationcase.RefundStatusRequested {
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, verificationevents.VerificationRefundRequestedType, row.SubscriptionID, now, verificationevents.RefundRequestedData{
			CaseId: row.ID.String(), SubscriptionId: row.SubscriptionID, AccountId: row.AccountID.String(), ProfileId: row.ProfileID.String(), Reason: reason, RefundScope: RefundScopeFor(row.PlanCode),
		}); err != nil {
			return nil, err
		}
	}
	if checkmarkShareRefundPlans[row.PlanCode] {
		return rejected, usersevents.EnqueueOutboxEventInTransaction(ctx, tx, verificationevents.VerificationCaseDecidedType, row.ProfileID.String(), now, caseEventData(rejected, false, reason))
	}
	notice := NoticeFor(profile, string(row.Color))
	notice.CaseId, notice.Reasons, notice.RefundMethod = row.ID.String(), []string{reason}, RefundMethodFor(row.PaymentChannel, refund == verificationcase.RefundStatusRequested)
	notice.ReapplyFrom = now.AddDate(0, 0, 30).UTC().Format(time.RFC3339)
	if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, verificationevents.VerificationRejectedNoticeType, profile.AccountID.String(), now, notice); err != nil {
		return nil, err
	}
	return rejected, usersevents.EnqueueOutboxEventInTransaction(ctx, tx, verificationevents.VerificationCaseDecidedType, row.ProfileID.String(), now, caseEventData(rejected, false, reason))
}

func ShareRefundNotice(profile *ent.Profile, row *ent.VerificationCase, outcome string, amount *verificationevents.Money, now time.Time) verificationevents.VerificationNotice {
	notice := NoticeFor(profile, string(row.Color))
	notice.CaseId, notice.Reasons, notice.ReapplyFrom = row.ID.String(), []string{row.DecisionReason}, now.AddDate(0, 0, 30).UTC().Format(time.RFC3339)
	notice.RefundMethod = ShareRefundMethodFor(outcome)
	if notice.RefundMethod != "plan_continues" {
		notice.RefundAmount = amount
	}
	return notice
}

func ShareRefundMethodFor(outcome string) string {
	switch outcome {
	case "verificationRefund.succeeded":
		return "plan_share_card"
	case "verificationRefund.manualStoreRefundRequired", "verificationRefund.failed":
		return "plan_share_store"
	}
	return "plan_continues"
}

func RefundMethodFor(channel string, refundable bool) string {
	switch {
	case !refundable:
		return "plan_continues"
	case channel == "apple_iap":
		return "apple_request"
	case channel == "google_play":
		return "google_play"
	}
	return "card"
}

func IsCaseOpen(status verificationcase.Status) bool {
	return status != verificationcase.StatusApproved && status != verificationcase.StatusRejected
}

func caseEventData(row *ent.VerificationCase, automatic bool, reason string) verificationevents.CaseEventData {
	return verificationevents.CaseEventData{
		CaseId: row.ID.String(), ProfileId: row.ProfileID.String(), AccountId: row.AccountID.String(), Color: string(row.Color),
		SubscriptionId: row.SubscriptionID, Status: string(row.Status), Reason: reason, AutoDecided: automatic,
	}
}
