package services

import (
	"context"
	"time"

	"zudomart/modules/moderation/src/events"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/copyrightclaim"
	contentservices "zudomart/modules/moderation/src/modules/contentReports/services"
	claimevents "zudomart/modules/moderation/src/modules/copyrightClaims/events"
	strikeservices "zudomart/modules/moderation/src/modules/strikes/services"
)

type UpholdParams struct {
	Claim     *ent.CopyrightClaim
	Reason    string
	StaffId   string
	StaffName string
	Settings  PolicySettings
	Now       func() time.Time
}

type UpholdOutcome struct {
	Remedy     string
	DeadlineAt *time.Time
	Strike     *ent.Strike
}

func infringerOf(claim *ent.CopyrightClaim) string {
	if claim.InfringerID == nil {
		return ""
	}
	return claim.InfringerID.String()
}

func ApplyUpheldRemedy(ctx context.Context, tx *ent.Tx, update *ent.CopyrightClaimUpdateOne, params UpholdParams) (UpholdOutcome, error) {
	claim, now := params.Claim, params.Now()
	infringer := infringerOf(claim)
	remedy := RemedyForUpheldClaim(string(claim.ClaimScope), string(claim.TargetType), claim.InfringerID != nil)
	outcome := UpholdOutcome{Remedy: remedy}
	update.SetRemedy(copyrightclaim.Remedy(remedy))
	data := claimevents.RemedyData{ClaimId: claim.ID.String(), TargetType: string(claim.TargetType), TargetId: claim.TargetID, InfringerId: infringer, WorkTitle: claim.WorkTitle, Reason: params.Reason, CanCounter: infringer != ""}
	recorder := strikeservices.Recorder{Now: params.Now}
	switch remedy {
	case RemedyAudioMuted:
		update.SetTargetFlag(copyrightclaim.TargetFlagMuted).SetRemedyState(copyrightclaim.RemedyStateMuted)
		return outcome, events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.AudioMuteOrderedType, claim.ID.String(), now, data)
	case RemedyTakedownWarning:
		deadline := TakedownDeadlineFrom(now, params.Settings)
		warning, _, err := recorder.Issue(ctx, tx, strikeservices.IssueParams{
			AccountId: *claim.InfringerID, Kind: "warning", Policy: "Copyright takedown notice", Reason: params.Reason, Source: "copyright", IssuedById: params.StaffId, IssuedByName: params.StaffName,
			ReferenceType: "copyright_claim", ReferenceId: claim.ID.String(), ExpiresInDays: params.Settings.WarningLifetimeDays,
		})
		if err != nil {
			return outcome, err
		}
		update.SetTargetFlag(copyrightclaim.TargetFlagWarned).SetRemedyState(copyrightclaim.RemedyStateAwaitingRemoval).SetTakedownDeadlineAt(deadline).SetWarningID(warning.ID)
		outcome.DeadlineAt = &deadline
		data.DeadlineAt, data.WarningId = deadline.UTC().Format(time.RFC3339), warning.ID.String()
		return outcome, events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.WarningIssuedType, claim.ID.String(), now, data)
	}
	update.SetTargetFlag(copyrightclaim.TargetFlagTakenDown).SetRemedyState(copyrightclaim.RemedyStateTakenDown)
	strike, err := TakeDownWithStrike(ctx, tx, claim, params.Reason, "removed", params.StaffId, params.StaffName, params.Settings, params.Now)
	if err != nil {
		return outcome, err
	}
	if strike != nil {
		update.SetStrikeID(strike.ID)
		data.StrikeId = strike.ID.String()
	}
	outcome.Strike = strike
	return outcome, events.EnqueueOutboxEventInTransaction(ctx, tx, claimevents.ContentTakenDownType, claim.ID.String(), now, data)
}

func TakeDownWithStrike(ctx context.Context, tx *ent.Tx, claim *ent.CopyrightClaim, reason, visibility, staffId, staffName string, settings PolicySettings, now func() time.Time) (*ent.Strike, error) {
	if err := contentservices.PublishVisibilityChange(ctx, tx, string(claim.TargetType), claim.TargetID, infringerOf(claim), visibility, "copyright", claim.ID.String(), reason, now()); err != nil {
		return nil, err
	}
	if claim.InfringerID == nil {
		return nil, nil
	}
	strike, _, err := (strikeservices.Recorder{Now: now}).Issue(ctx, tx, strikeservices.IssueParams{
		AccountId: *claim.InfringerID, Kind: "strike", Policy: "Copyright infringement", Reason: reason, Source: "copyright", IssuedById: staffId, IssuedByName: staffName,
		ReferenceType: "copyright_claim", ReferenceId: claim.ID.String(), ExpiresInDays: settings.StrikeLifetimeDays,
	})
	return strike, err
}
