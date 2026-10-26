package transitionblackapplication

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/blackapplication"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	"nantty/modules/users/src/generated/ent/usernamehold"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
	checkmarkevents "nantty/modules/users/src/modules/checkmarks/events"
	"nantty/modules/users/src/modules/checkmarks/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	id, err := uuid.Parse(command.Id)
	if err != nil {
		return usersErrors.NotFound("That application was not found.")
	}
	reason := command.Reason
	if command.Action == ActionReject || command.Action == ActionRevoke || command.Action == ActionApprove {
		if reason, err = accountservices.RequireReason(command.Reason); err != nil {
			return err
		}
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.BlackApplication.Query().Where(blackapplication.ID(id)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return usersErrors.NotFound("That application was not found.")
		}
		if err != nil {
			return err
		}
		auditAction, after, err := handler.apply(ctx, tx, row, command, reason)
		if err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: auditAction, SubjectType: "black_application", SubjectId: row.ID.String(), SubjectLabel: row.AgencyName, Reason: reason,
			Before: map[string]any{"status": row.Status}, After: after,
		})
	})
}

func (handler Handler) apply(ctx context.Context, tx *ent.Tx, row *ent.BlackApplication, command Command, reason string) (string, map[string]any, error) {
	open := row.Status == blackapplication.StatusInReview || row.Status == blackapplication.StatusAwaitingSecondApproval
	now := handler.Container.Now()
	switch command.Action {
	case ActionChecklist:
		return handler.updateChecklist(ctx, row, command, open)
	case ActionApprove:
		return handler.approve(ctx, tx, row, command, reason, now)
	case ActionReject:
		if !open {
			return "", nil, usersErrors.Conflict("NOT_OPEN", "This application is no longer open.")
		}
		err := row.Update().SetStatus(blackapplication.StatusRejected).SetDecisionReason(reason).Exec(ctx)
		return "black_application.rejected", map[string]any{"status": "rejected"}, err
	case ActionRevoke:
		return handler.revoke(ctx, tx, row, reason, now)
	case ActionReminder:
		if row.Status != blackapplication.StatusApproved {
			return "", nil, usersErrors.Conflict("NOT_APPROVED", "Only approved applications are re-verified.")
		}
		if err := row.Update().SetReverificationRemindedAt(now).Exec(ctx); err != nil {
			return "", nil, err
		}
		err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, checkmarkevents.BlackReverificationDueType, row.ProfileID.String(), now, checkmarkevents.ApplicationEventData{ApplicationId: row.ID.String(), ProfileId: row.ProfileID.String(), AccountId: row.AccountID.String(), Color: "black"})
		return "black_application.reverification_reminder_sent", map[string]any{"remindedAt": now}, err
	}
	return "", nil, usersErrors.NotFound("That action does not exist.")
}

func (handler Handler) updateChecklist(ctx context.Context, row *ent.BlackApplication, command Command, open bool) (string, map[string]any, error) {
	if !open {
		return "", nil, usersErrors.Conflict("NOT_OPEN", "This application is no longer open.")
	}
	items := services.DecodeChecklist(row)
	found := false
	for index := range items {
		if items[index].Key != command.Key {
			continue
		}
		found = true
		items[index].IsVerified, items[index].Note = command.IsVerified, command.Note
		if command.IsVerified {
			name := command.Actor.Name
			items[index].VerifiedByName = &name
		} else {
			items[index].VerifiedByName = nil
		}
	}
	if !found {
		return "", nil, usersErrors.ValidationFailedFor("key", "is not a checklist item")
	}
	encoded, _ := json.Marshal(items)
	update := row.Update().SetChecklist(encoded)
	if !command.IsVerified && row.Status == blackapplication.StatusAwaitingSecondApproval {
		update.SetStatus(blackapplication.StatusInReview).SetFirstApprovalBy("").SetFirstApprovalByName("").ClearFirstApprovalAt()
	}
	return "black_application.checklist_updated", map[string]any{"key": command.Key, "isVerified": command.IsVerified}, update.Exec(ctx)
}

func (handler Handler) approve(ctx context.Context, tx *ent.Tx, row *ent.BlackApplication, command Command, reason string, now time.Time) (string, map[string]any, error) {
	switch row.Status {
	case blackapplication.StatusInReview:
		for _, item := range services.DecodeChecklist(row) {
			if !item.IsVerified {
				return "", nil, usersErrors.Conflict("CHECKLIST_INCOMPLETE", "Every vetting item must be verified before approval.")
			}
		}
		err := row.Update().SetStatus(blackapplication.StatusAwaitingSecondApproval).SetFirstApprovalBy(command.Actor.Id).SetFirstApprovalByName(command.Actor.Name).SetFirstApprovalAt(now).SetDecisionReason(reason).Exec(ctx)
		return "black_application.first_approval", map[string]any{"status": "awaiting_second_approval"}, err
	case blackapplication.StatusAwaitingSecondApproval:
		if row.FirstApprovalBy == command.Actor.Id {
			return "", nil, usersErrors.Conflict("SAME_ADMIN", "A different admin must give the second approval.")
		}
		due := now.AddDate(1, 0, 0)
		if err := row.Update().SetStatus(blackapplication.StatusApproved).SetSecondApprovalBy(command.Actor.Id).SetSecondApprovalByName(command.Actor.Name).SetSecondApprovalAt(now).SetHandleReserved(true).SetReverificationDueAt(due).SetDecisionReason(reason).Exec(ctx); err != nil {
			return "", nil, err
		}
		return "black_application.approved", map[string]any{"status": "approved", "reverificationDueAt": due}, handler.grantBlack(ctx, tx, row, due, now)
	}
	return "", nil, usersErrors.Conflict("NOT_OPEN", "This application is no longer open.")
}

func (handler Handler) grantBlack(ctx context.Context, tx *ent.Tx, row *ent.BlackApplication, due, now time.Time) error {
	profile, err := tx.Profile.Get(ctx, row.ProfileID)
	if err != nil {
		return err
	}
	if _, err := services.SetProfileCheckmarkInTransaction(ctx, tx, now, services.CheckmarkChange{Profile: profile, Color: profilecheckmark.ColorBlack, Status: profilecheckmark.StatusVerified, Source: profilecheckmark.SourceBlackVetting, SourceId: &row.ID, ReverificationDueAt: &due, ReserveHandle: true}); err != nil {
		return err
	}
	if _, err := tx.UsernameHold.Delete().Where(usernamehold.Username(row.Handle)).Exec(ctx); err != nil {
		return err
	}
	if err := tx.UsernameHold.Create().SetUsername(row.Handle).SetKind(usernamehold.KindReservedOfficial).SetHeldForAccountID(row.AccountID).SetReason("official handle").Exec(ctx); err != nil {
		return err
	}
	notice := services.NoticeBase(profile, "black")
	notice.RenewsAt = due.UTC().Format(time.RFC3339)
	if err := services.EnqueueCheckmarkNoticeInTransaction(ctx, tx, now, "checkmark.approved", notice); err != nil {
		return err
	}
	return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, checkmarkevents.BlackApplicationDecidedType, row.ProfileID.String(), now, checkmarkevents.ApplicationEventData{ApplicationId: row.ID.String(), ProfileId: row.ProfileID.String(), AccountId: row.AccountID.String(), Color: "black", Status: "approved"})
}

func (handler Handler) revoke(ctx context.Context, tx *ent.Tx, row *ent.BlackApplication, reason string, now time.Time) (string, map[string]any, error) {
	if row.Status != blackapplication.StatusApproved {
		return "", nil, usersErrors.Conflict("NOT_APPROVED", "Only an approved application can be revoked.")
	}
	if err := row.Update().SetStatus(blackapplication.StatusRevoked).SetDecisionReason(reason).Exec(ctx); err != nil {
		return "", nil, err
	}
	profile, err := tx.Profile.Get(ctx, row.ProfileID)
	if err != nil {
		return "", nil, err
	}
	if _, err := services.SetProfileCheckmarkInTransaction(ctx, tx, now, services.CheckmarkChange{Profile: profile, Color: profilecheckmark.ColorBlack, Status: profilecheckmark.StatusRevoked, Source: profilecheckmark.SourceBlackVetting, SourceId: &row.ID}); err != nil {
		return "", nil, err
	}
	revoked := services.NoticeBase(profile, "black")
	revoked.Reason, revoked.AppealUrl = reason, services.AppealUrl()
	if err := services.EnqueueCheckmarkNoticeInTransaction(ctx, tx, now, "checkmark.revoked", revoked); err != nil {
		return "", nil, err
	}
	err = usersevents.EnqueueOutboxEventInTransaction(ctx, tx, checkmarkevents.BlackApplicationDecidedType, row.ProfileID.String(), now, checkmarkevents.ApplicationEventData{ApplicationId: row.ID.String(), ProfileId: row.ProfileID.String(), AccountId: row.AccountID.String(), Color: "black", Status: "revoked", Reason: reason})
	return "black_application.revoked", map[string]any{"status": "revoked", "handleReserved": true}, err
}
