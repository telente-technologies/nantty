package transitionverification

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/profilecheckmark"
	"zudomart/modules/users/src/generated/ent/verificationapplication"
	accountservices "zudomart/modules/users/src/modules/accountEnforcement/services"
	checkmarkevents "zudomart/modules/users/src/modules/checkmarks/events"
	"zudomart/modules/users/src/modules/checkmarks/services"
	usersservices "zudomart/modules/users/src/services"
)

type transition struct {
	from   []verificationapplication.Status
	to     verificationapplication.Status
	status profilecheckmark.Status
}

var transitions = map[string]transition{
	ActionApprove:   {[]verificationapplication.Status{verificationapplication.StatusPending}, verificationapplication.StatusApproved, profilecheckmark.StatusVerified},
	ActionReject:    {[]verificationapplication.Status{verificationapplication.StatusPending}, verificationapplication.StatusRejected, ""},
	ActionSuspend:   {[]verificationapplication.Status{verificationapplication.StatusApproved}, verificationapplication.StatusSuspended, profilecheckmark.StatusSuspended},
	ActionRevoke:    {[]verificationapplication.Status{verificationapplication.StatusApproved, verificationapplication.StatusSuspended}, verificationapplication.StatusRevoked, profilecheckmark.StatusRevoked},
	ActionReinstate: {[]verificationapplication.Status{verificationapplication.StatusSuspended}, verificationapplication.StatusApproved, profilecheckmark.StatusVerified},
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	reason, err := accountservices.RequireReason(command.Reason)
	if err != nil {
		return err
	}
	rule, known := transitions[command.Action]
	applicationId, parseErr := uuid.Parse(command.ApplicationId)
	if !known || parseErr != nil {
		return usersErrors.NotFound("That verification request was not found.")
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		application, err := tx.VerificationApplication.Query().Where(verificationapplication.ID(applicationId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return usersErrors.NotFound("That verification request was not found.")
		}
		if err != nil {
			return err
		}
		if !contains(rule.from, application.Status) {
			return usersErrors.Conflict("INVALID_TRANSITION", "This request cannot move to that state.")
		}
		now := handler.Container.Now()
		if err := application.Update().SetStatus(rule.to).SetDecisionReason(reason).SetReviewedByName(command.Actor.Name).SetReviewedAt(now).Exec(ctx); err != nil {
			return err
		}
		if rule.status != "" {
			if err := handler.applyCheckmark(ctx, tx, application, rule.status, now); err != nil {
				return err
			}
		}
		if err := handler.notify(ctx, tx, application, command.Action, reason, now); err != nil {
			return err
		}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, checkmarkevents.VerificationApplicationDecidedType, application.ProfileID.String(), now, checkmarkevents.ApplicationEventData{
			ApplicationId: application.ID.String(), ProfileId: application.ProfileID.String(), AccountId: application.AccountID.String(), Color: string(application.Color), Status: string(rule.to), Reason: reason,
		}); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "verification." + pastTense(command.Action), SubjectType: "verification", SubjectId: application.ID.String(), SubjectLabel: application.AccountID.String(), Reason: reason,
			Before: map[string]any{"status": application.Status}, After: map[string]any{"status": rule.to, "color": application.Color, "badgeVisible": rule.status == profilecheckmark.StatusVerified},
		})
	})
}

func (handler Handler) applyCheckmark(ctx context.Context, tx *ent.Tx, application *ent.VerificationApplication, status profilecheckmark.Status, now time.Time) error {
	profile, err := tx.Profile.Get(ctx, application.ProfileID)
	if err != nil {
		return err
	}
	_, err = services.SetProfileCheckmarkInTransaction(ctx, tx, now, services.CheckmarkChange{
		Profile: profile, Color: profilecheckmark.Color(application.Color), Status: status, Source: profilecheckmark.SourceApplication, SourceId: &application.ID,
	})
	return err
}

func contains(statuses []verificationapplication.Status, wanted verificationapplication.Status) bool {
	for _, status := range statuses {
		if status == wanted {
			return true
		}
	}
	return false
}

func pastTense(action string) string {
	return map[string]string{ActionApprove: "approved", ActionReject: "rejected", ActionSuspend: "suspended", ActionRevoke: "revoked", ActionReinstate: "reinstated"}[action]
}

func (handler Handler) notify(ctx context.Context, tx *ent.Tx, application *ent.VerificationApplication, action, reason string, now time.Time) error {
	profile, err := tx.Profile.Get(ctx, application.ProfileID)
	if err != nil {
		return err
	}
	notice := services.NoticeBase(profile, string(application.Color))
	eventType := ""
	switch action {
	case ActionApprove, ActionReinstate:
		eventType, notice.RenewsAt = "checkmark.approved", services.OneYearFrom(now)
	case ActionReject:
		eventType, notice.Reasons, notice.ReapplyFrom = "checkmark.rejected", []string{reason}, now.AddDate(0, 0, 30).UTC().Format(time.RFC3339)
	case ActionRevoke, ActionSuspend:
		eventType, notice.Reason, notice.AppealUrl = "checkmark.revoked", reason, services.AppealUrl()
	default:
		return nil
	}
	return services.EnqueueCheckmarkNoticeInTransaction(ctx, tx, now, eventType, notice)
}
