package submitblackapplication

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/blackapplication"
	"nantty/modules/users/src/generated/ent/profile"
	checkmarkevents "nantty/modules/users/src/modules/checkmarks/events"
	"nantty/modules/users/src/modules/checkmarks/services"
	usersservices "nantty/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (string, error) {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return "", usersErrors.ErrAccountUnavailable
	}
	agency, representative, role := strings.TrimSpace(command.AgencyName), strings.TrimSpace(command.RepresentativeName), strings.TrimSpace(command.RepresentativeRole)
	if len(agency) < 2 || len(representative) < 2 || len(role) < 2 || len(agency) > 120 {
		return "", usersErrors.ValidationFailedFor("agencyName", "agency, representative and role are required")
	}
	personal, _, err := usersservices.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return "", err
	}
	activeId, err := usersservices.ActiveProfileIdFor(ctx, handler.Container, owner, personal)
	if err != nil {
		return "", err
	}
	profileId, _ := uuid.Parse(activeId)
	acting, err := handler.Container.Client.Profile.Get(ctx, profileId)
	if err != nil {
		return "", err
	}
	if acting.ProfileType != profile.ProfileTypeGovernment {
		return "", usersErrors.Conflict("GOVERNMENT_PROFILE_REQUIRED", "Only government profiles can apply for the Black checkmark.")
	}
	if open, err := handler.Container.Client.BlackApplication.Query().Where(blackapplication.ProfileID(acting.ID), blackapplication.StatusIn(blackapplication.StatusInReview, blackapplication.StatusAwaitingSecondApproval, blackapplication.StatusApproved)).Exist(ctx); err != nil || open {
		return "", usersErrors.OrConflict(err, "APPLICATION_EXISTS", "This profile already has a Black application.")
	}
	checklist := make([]services.ChecklistItem, 0, len(services.ChecklistDefinitions))
	for _, item := range services.ChecklistDefinitions {
		checklist = append(checklist, item)
	}
	encoded, _ := json.Marshal(checklist)
	var created *ent.BlackApplication
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if created, err = tx.BlackApplication.Create().SetProfileID(acting.ID).SetAccountID(owner).SetAgencyName(agency).SetHandle(acting.Handle).SetRepresentativeName(representative).SetRepresentativeRole(role).SetChecklist(encoded).Save(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, checkmarkevents.VerificationApplicationSubmittedType, acting.ID.String(), handler.Container.Now(), checkmarkevents.ApplicationEventData{
			ApplicationId: created.ID.String(), ProfileId: acting.ID.String(), AccountId: owner.String(), Color: "black",
		})
	})
	if err != nil {
		return "", err
	}
	return created.ID.String(), nil
}
