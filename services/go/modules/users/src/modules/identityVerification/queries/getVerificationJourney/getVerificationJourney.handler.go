package getverificationjourney

import (
	"context"
	"errors"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	"nantty/modules/users/src/generated/ent/verificationcase"
	"nantty/modules/users/src/generated/ent/verificationeligibility"
	checkmarkservices "nantty/modules/users/src/modules/checkmarks/services"
	"nantty/modules/users/src/modules/identityVerification/services"
)

const assessmentFreshFor = time.Hour

type Eligibility struct {
	State       string   `json:"state"`
	Tier        string   `json:"tier"`
	TrustScore  int      `json:"trustScore"`
	Reasons     []string `json:"reasons"`
	CanBuyNow   bool     `json:"canBuyNow"`
	RequestedAt *string  `json:"requestedAt"`
	NextCheckAt *string  `json:"nextCheckAt"`
}

type Checkmark struct {
	Color        string `json:"color"`
	Status       string `json:"status"`
	BadgeVisible bool   `json:"badgeVisible"`
}

type Result struct {
	ProfileId        string             `json:"profileId"`
	ProfileType      string             `json:"profileType"`
	Color            string             `json:"color"`
	BlackVetting     bool               `json:"blackVetting"`
	PlanCode         string             `json:"planCode"`
	ConsentVersion   string             `json:"consentVersion"`
	PrivacyPolicyUrl string             `json:"privacyPolicyUrl"`
	Eligibility      *Eligibility       `json:"eligibility"`
	Case             *services.CaseView `json:"case"`
	Checkmark        *Checkmark         `json:"checkmark"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, accountId string) (Result, error) {
	acting, account, err := checkmarkservices.LoadActingProfile(ctx, handler.Container, accountId)
	if err != nil {
		return Result{}, err
	}
	result := Result{
		ProfileId: acting.ID.String(), ProfileType: string(acting.ProfileType), ConsentVersion: handler.Container.Settings.Verification.ConsentVersion,
		PrivacyPolicyUrl: handler.Container.Settings.Verification.PrivacyPolicyUrl,
	}
	if mark, err := handler.Container.Client.ProfileCheckmark.Query().Where(profilecheckmark.ProfileID(acting.ID)).Only(ctx); err == nil {
		result.Checkmark = &Checkmark{Color: string(mark.Color), Status: string(mark.Status), BadgeVisible: checkmarkservices.BadgeVisible(mark.Status)}
	} else if !ent.IsNotFound(err) {
		return Result{}, err
	}
	color, err := services.ColorForVerification(acting)
	if errors.Is(err, services.ErrBlackUsesVetting) {
		result.Color, result.BlackVetting = "black", true
		return result, nil
	}
	result.Color, result.PlanCode = color, map[string]string{"blue": "blue", "gold": "gold_only"}[color]
	if latest, err := handler.Container.Client.VerificationCase.Query().Where(verificationcase.ProfileID(acting.ID)).Order(ent.Desc(verificationcase.FieldCreatedAt)).First(ctx); err == nil {
		view := services.ConvertCaseToViewAt(latest, false, handler.Container.Now())
		result.Case = &view
	} else if !ent.IsNotFound(err) {
		return Result{}, err
	}
	row, err := handler.Container.Client.VerificationEligibility.Query().Where(verificationeligibility.ProfileID(acting.ID)).Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return Result{}, err
	}
	if row == nil || row.LastCheckedAt == nil || handler.Container.Now().Sub(*row.LastCheckedAt) > assessmentFreshFor {
		signals, err := services.BuildEligibilitySignals(ctx, handler.Container, acting, account, color)
		if err != nil {
			return Result{}, err
		}
		change, err := services.StoreEligibilityAssessment(ctx, handler.Container, acting, color, services.AssessVerificationEligibility(ctx, handler.Container, signals), false)
		if err != nil {
			return Result{}, err
		}
		row = change.Row
	}
	result.Eligibility = ConvertEligibility(row)
	return result, nil
}

func ConvertEligibility(row *ent.VerificationEligibility) *Eligibility {
	format := func(value *time.Time) *string {
		if value == nil {
			return nil
		}
		text := value.UTC().Format(time.RFC3339)
		return &text
	}
	reasons := row.Reasons
	if reasons == nil {
		reasons = []string{}
	}
	return &Eligibility{
		State: string(row.State), Tier: string(row.Tier), TrustScore: row.TrustScore, Reasons: reasons,
		CanBuyNow:   row.State == verificationeligibility.StateEligible || row.Tier == verificationeligibility.TierBuyNow,
		RequestedAt: format(row.RequestedAt), NextCheckAt: format(row.NextCheckAt),
	}
}
