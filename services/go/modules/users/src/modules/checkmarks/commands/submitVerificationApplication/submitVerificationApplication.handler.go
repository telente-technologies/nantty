package submitverificationapplication

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/verificationapplication"
	checkmarkevents "zudomart/modules/users/src/modules/checkmarks/events"
	"zudomart/modules/users/src/modules/checkmarks/services"
	usersservices "zudomart/modules/users/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	owner, err := uuid.Parse(command.AccountId)
	if err != nil {
		return Result{}, usersErrors.ErrAccountUnavailable
	}
	personal, _, err := usersservices.EnsurePersonalProfile(ctx, handler.Container, owner)
	if err != nil {
		return Result{}, err
	}
	activeId, err := usersservices.ActiveProfileIdFor(ctx, handler.Container, owner, personal)
	if err != nil {
		return Result{}, err
	}
	profileId, _ := uuid.Parse(activeId)
	acting, err := handler.Container.Client.Profile.Get(ctx, profileId)
	if err != nil {
		return Result{}, err
	}
	color := string(services.ColorForProfileType(acting.ProfileType))
	if color != command.Kind || color == "black" {
		return Result{}, usersErrors.ValidationFailedFor("kind", "must match the checkmark colour of the active profile type: "+color)
	}
	if err := handler.assertAllowed(ctx, acting, color); err != nil {
		return Result{}, err
	}
	applicant, _ := json.Marshal(map[string]any{
		"legalName": command.LegalName, "documentType": command.DocumentType, "documentNumber": maskDocumentNumber(command.DocumentNumber),
		"businessName": command.BusinessName, "registrationNumber": command.RegistrationNumber, "businessAddress": command.BusinessAddress, "country": acting.CountryCode,
	})
	documents := command.DocumentUrls
	var created *ent.VerificationApplication
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if created, err = tx.VerificationApplication.Create().SetProfileID(acting.ID).SetAccountID(owner).SetColor(verificationapplication.Color(color)).SetPlanID(command.PlanId).SetApplicant(applicant).SetDocumentKeys(nonEmpty(documents)).Save(ctx); err != nil {
			return err
		}
		notice := services.NoticeBase(acting, color)
		notice.ApplicationId, notice.ReviewWithinDays = created.ID.String(), 3
		if err := services.EnqueueCheckmarkNoticeInTransaction(ctx, tx, handler.Container.Now(), "checkmark.applicationSubmitted", notice); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, checkmarkevents.VerificationApplicationSubmittedType, acting.ID.String(), handler.Container.Now(), checkmarkevents.ApplicationEventData{
			ApplicationId: created.ID.String(), ProfileId: acting.ID.String(), AccountId: owner.String(), Color: color,
		})
	})
	return Result{ApplicationId: created.ID.String()}, err
}

func (handler Handler) assertAllowed(ctx context.Context, acting *ent.Profile, color string) error {
	live, err := services.HasLiveCheckmark(ctx, handler.Container, acting.ID)
	if err != nil {
		return err
	}
	if live {
		return usersErrors.Conflict("ALREADY_VERIFIED", "This profile already has a checkmark.")
	}
	pending, err := handler.Container.Client.VerificationApplication.Query().Where(verificationapplication.ProfileID(acting.ID), verificationapplication.StatusEQ(verificationapplication.StatusPending)).Exist(ctx)
	if err != nil || pending {
		return usersErrors.OrConflict(err, "APPLICATION_PENDING", "An application for this profile is already being reviewed.")
	}
	if color != "gold" {
		return nil
	}
	approved, err := services.BusinessDocumentsAllApproved(ctx, handler.Container, acting.AccountID)
	if err != nil || !approved {
		return usersErrors.OrConflict(err, "BUSINESS_VERIFICATION_REQUIRED", "Business documents must be approved before a Gold checkmark can be applied for.")
	}
	return nil
}

func maskDocumentNumber(number string) string {
	if len(number) <= 4 {
		return "****"
	}
	return "****" + number[len(number)-4:]
}

func nonEmpty(values []string) []string {
	kept := []string{}
	for _, value := range values {
		if value != "" {
			kept = append(kept, value)
		}
	}
	return kept
}
