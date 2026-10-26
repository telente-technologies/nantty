package decidecreatorapplication

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/creatorapplication"
	"nantty/modules/users/src/generated/ent/profile"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
	creatorevents "nantty/modules/users/src/modules/creatorProgram/events"
	creatorservices "nantty/modules/users/src/modules/creatorProgram/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	reason, err := accountservices.RequireReason(command.Reason)
	if err != nil {
		return err
	}
	applicationId, err := uuid.Parse(command.ApplicationId)
	if err != nil {
		return usersErrors.NotFound("That application was not found.")
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		application, err := tx.CreatorApplication.Query().Where(creatorapplication.ID(applicationId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return usersErrors.NotFound("That application was not found.")
		}
		if err != nil {
			return err
		}
		if application.Status != creatorapplication.StatusPending {
			return usersErrors.Conflict("ALREADY_DECIDED", "This application was already decided.")
		}
		now := handler.Container.Now()
		status, creatorStatus, action := creatorapplication.StatusRejected, profile.CreatorStatusRejected, "creator_application.rejected"
		update := application.Update().SetReviewedBy(command.Actor.Id).SetReviewedByName(command.Actor.Name).SetReviewedAt(now).SetDecisionReason(reason)
		if command.Approve {
			status, creatorStatus, action = creatorapplication.StatusApproved, profile.CreatorStatusApproved, "creator_application.approved"
			if err := creatorservices.GrantCreatorRoleToAccount(ctx, application.AccountID); err != nil {
				return err
			}
		} else {
			update.SetReapplyAvailableAt(now.Add(30 * 24 * time.Hour))
		}
		if err := update.SetStatus(status).Exec(ctx); err != nil {
			return err
		}
		if err := tx.Profile.UpdateOneID(application.ProfileID).SetCreatorStatus(creatorStatus).Exec(ctx); err != nil {
			return err
		}
		decided, err := tx.CreatorApplication.Get(ctx, application.ID)
		if err != nil {
			return err
		}
		owner, err := tx.Profile.Get(ctx, application.ProfileID)
		if err != nil {
			return err
		}
		if err := creatorservices.EnqueueCreatorNoticeInTransaction(ctx, tx, now, decided, owner, creatorservices.RequirementsOfApplication(application)); err != nil {
			return err
		}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, creatorevents.CreatorApplicationDecidedType, application.AccountID.String(), now, creatorevents.DecidedData{
			AccountId: application.AccountID.String(), ApplicationId: application.ID.String(), Status: string(status), Decision: string(application.Decision), Reason: reason, ReviewedBy: command.Actor.Id,
		}); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: action, SubjectType: "creator_application", SubjectId: application.ID.String(), SubjectLabel: application.AccountID.String(), Reason: reason,
			Before: map[string]any{"status": "pending"}, After: map[string]any{"status": status, "creatorStatus": creatorStatus},
		})
	})
}
