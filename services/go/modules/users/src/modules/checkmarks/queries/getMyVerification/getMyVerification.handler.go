package getmyverification

import (
	"context"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/blackapplication"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	"nantty/modules/users/src/generated/ent/verificationapplication"
	"nantty/modules/users/src/modules/checkmarks/services"
)

type Current struct {
	Status       string  `json:"status"`
	Type         string  `json:"type"`
	Color        string  `json:"color"`
	Tier         string  `json:"tier"`
	BadgeVisible bool    `json:"badgeVisible"`
	GraceEndsAt  *string `json:"graceEndsAt"`
}

type Application struct {
	Id              string  `json:"id"`
	Color           string  `json:"color"`
	Status          string  `json:"status"`
	SubmittedAt     string  `json:"submittedAt"`
	RejectionReason *string `json:"rejectionReason"`
}

type Result struct {
	Current             *Current                       `json:"current"`
	Subscription        any                            `json:"subscription"`
	Application         *Application                   `json:"application"`
	BlackApplication    *services.BlackApplicationView `json:"blackApplication,omitempty"`
	HandleReserved      bool                           `json:"handleReserved"`
	ReverificationDueAt *string                        `json:"reverificationDueAt"`
}

type Handler struct {
	Container *container.Container
}

var tiers = map[profilecheckmark.Color]string{profilecheckmark.ColorBlue: "VERIFIED", profilecheckmark.ColorGold: "PRO", profilecheckmark.ColorBlack: "OFFICIAL"}

func (handler Handler) Execute(ctx context.Context, accountId string) (Result, error) {
	acting, _, err := services.LoadActingProfile(ctx, handler.Container, accountId)
	if err != nil {
		return Result{}, err
	}
	result := Result{}
	row, err := handler.Container.Client.ProfileCheckmark.Query().Where(profilecheckmark.ProfileID(acting.ID)).Only(ctx)
	if err == nil {
		result.Current = currentOf(row, acting)
		result.HandleReserved = row.HandleReserved
		if row.ReverificationDueAt != nil {
			due := row.ReverificationDueAt.UTC().Format(time.RFC3339)
			result.ReverificationDueAt = &due
		}
	} else if !ent.IsNotFound(err) {
		return result, err
	}
	application, err := handler.Container.Client.VerificationApplication.Query().Where(verificationapplication.ProfileID(acting.ID)).Order(ent.Desc(verificationapplication.FieldID)).First(ctx)
	if err == nil {
		result.Application = &Application{Id: application.ID.String(), Color: string(application.Color), Status: map[verificationapplication.Status]string{
			verificationapplication.StatusPending: "pending", verificationapplication.StatusApproved: "approved", verificationapplication.StatusRejected: "rejected",
			verificationapplication.StatusSuspended: "approved", verificationapplication.StatusRevoked: "rejected"}[application.Status], SubmittedAt: application.CreatedAt.UTC().Format(time.RFC3339)}
		if application.Status == verificationapplication.StatusRejected {
			result.Application.RejectionReason = &application.DecisionReason
		}
		if result.Current == nil && application.Status == verificationapplication.StatusPending {
			result.Current = &Current{Status: "pending", Type: profileTypeOf(acting), Color: string(application.Color), Tier: tiers[profilecheckmark.Color(application.Color)]}
		}
	} else if !ent.IsNotFound(err) {
		return result, err
	}
	if acting.ProfileType == profile.ProfileTypeGovernment {
		blackApp, blackErr := handler.Container.Client.BlackApplication.Query().Where(blackapplication.ProfileID(acting.ID)).Order(ent.Desc(blackapplication.FieldID)).First(ctx)
		if blackErr == nil {
			if view, viewErr := services.BuildBlackApplicationView(ctx, handler.Container, blackApp); viewErr == nil {
				result.BlackApplication = &view
				if blackApp.HandleReserved {
					result.HandleReserved = true
				}
				if result.Current != nil && result.Current.Color == "black" && result.Current.Status == "revoked" && blackApp.Status == blackapplication.StatusApproved {
					result.Current.Status = "paused"
				}
			}
		} else if !ent.IsNotFound(blackErr) {
			return result, blackErr
		}
	}
	return result, nil
}

func currentOf(row *ent.ProfileCheckmark, acting *ent.Profile) *Current {
	status := map[profilecheckmark.Status]string{profilecheckmark.StatusVerified: "active", profilecheckmark.StatusGrace: "active", profilecheckmark.StatusSuspended: "revoked", profilecheckmark.StatusRevoked: "revoked", profilecheckmark.StatusExpired: "expired"}[row.Status]
	current := &Current{Status: status, Type: profileTypeOf(acting), Color: string(row.Color), Tier: tiers[row.Color], BadgeVisible: services.BadgeVisible(row.Status)}
	if row.GraceEndsAt != nil {
		grace := row.GraceEndsAt.UTC().Format(time.RFC3339)
		current.GraceEndsAt = &grace
	}
	return current
}

func profileTypeOf(acting *ent.Profile) string {
	switch acting.ProfileType {
	case profile.ProfileTypeGovernment:
		return "government"
	case profile.ProfileTypeBusiness, profile.ProfileTypeBrand:
		return "business"
	}
	return "personal"
}
