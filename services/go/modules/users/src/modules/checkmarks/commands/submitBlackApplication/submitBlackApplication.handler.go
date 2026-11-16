package submitblackapplication

import (
	"context"
	"encoding/json"
	"net/mail"
	"regexp"
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

var countryCodePattern = regexp.MustCompile(`^[A-Z]{2}$`)

type Handler struct {
	Container *container.Container
}

func isValidEmail(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" || len(trimmed) > 254 {
		return false
	}
	parsed, err := mail.ParseAddress(trimmed)
	return err == nil && parsed.Address == trimmed && strings.Contains(trimmed[strings.LastIndex(trimmed, "@")+1:], ".")
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
	institutionalEmail := strings.ToLower(strings.TrimSpace(command.InstitutionalEmail))
	if !isValidEmail(institutionalEmail) {
		return "", usersErrors.ValidationFailedFor("institutionalEmail", "a valid official institutional email is required")
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
	jurisdiction := strings.ToUpper(strings.TrimSpace(command.JurisdictionCountryCode))
	if jurisdiction == "" {
		jurisdiction = strings.ToUpper(strings.TrimSpace(acting.CountryCode))
	}
	if !countryCodePattern.MatchString(jurisdiction) {
		return "", usersErrors.ValidationFailedFor("jurisdictionCountryCode", "a 2-letter verified legal jurisdiction country code is required")
	}
	if open, err := handler.Container.Client.BlackApplication.Query().Where(blackapplication.ProfileID(acting.ID), blackapplication.StatusIn(
		blackapplication.StatusPending, blackapplication.StatusInReview, blackapplication.StatusAwaitingSecondApproval, blackapplication.StatusApproved, blackapplication.StatusReverificationRequired,
	)).Exist(ctx); err != nil || open {
		return "", usersErrors.OrConflict(err, "APPLICATION_EXISTS", "This profile already has a Black application.")
	}
	checklist := make([]services.ChecklistItem, 0, len(services.ChecklistDefinitions))
	checklist = append(checklist, services.ChecklistDefinitions...)
	encoded, _ := json.Marshal(checklist)
	var created *ent.BlackApplication
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if created, err = tx.BlackApplication.Create().SetProfileID(acting.ID).SetAccountID(owner).SetAgencyName(agency).SetHandle(acting.Handle).
			SetRepresentativeName(representative).SetRepresentativeRole(role).SetStatus(blackapplication.StatusPending).SetChecklist(encoded).Save(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, checkmarkevents.VerificationApplicationSubmittedType, acting.ID.String(), handler.Container.Now(), checkmarkevents.ApplicationEventData{
			ApplicationId: created.ID.String(), ProfileId: acting.ID.String(), AccountId: owner.String(), Color: "black",
		})
	})
	if err != nil {
		return "", err
	}
	legalName := strings.TrimSpace(command.LegalIdentityName)
	if legalName == "" {
		legalName = agency
	}
	if err := services.SaveBlackApplicationDetails(ctx, handler.Container.Database, created.ID, services.BlackApplicationExtended{
		LegalIdentityName: legalName, LegalRegistrationRef: strings.TrimSpace(command.LegalRegistrationRef),
		JurisdictionCountryCode: jurisdiction, OfficialWebsite: strings.TrimSpace(command.OfficialWebsite),
		OfficialContactPhone: strings.TrimSpace(command.OfficialContactPhone), InstitutionalEmail: institutionalEmail,
		RepresentativeEmail: strings.TrimSpace(command.RepresentativeEmail), RepresentativeIdRef: strings.TrimSpace(command.RepresentativeIdRef),
		EvidenceNotes: strings.TrimSpace(command.EvidenceNotes),
	}); err != nil {
		return "", err
	}
	if _, expiresAt, err := services.IssueInstitutionalEmailOtp(ctx, handler.Container, created.ID, owner, institutionalEmail); err == nil {
		_ = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
			return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, "blackApplication.institutionalEmailOtpRequested", created.ID.String(), handler.Container.Now(), map[string]any{
				"applicationId": created.ID.String(), "accountId": owner.String(), "email": institutionalEmail, "expiresAt": expiresAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
			})
		})
	}
	return created.ID.String(), nil
}
