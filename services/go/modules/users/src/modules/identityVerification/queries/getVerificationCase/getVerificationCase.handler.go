package getverificationcase

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/verificationeligibility"
	creatorservices "zudomart/modules/users/src/modules/creatorProgram/services"
	getverificationjourney "zudomart/modules/users/src/modules/identityVerification/queries/getVerificationJourney"
	"zudomart/modules/users/src/modules/identityVerification/services"
	usersservices "zudomart/modules/users/src/services"
)

type Profile struct {
	Handle      string `json:"handle"`
	DisplayName string `json:"displayName"`
	ProfileType string `json:"profileType"`
	AccountName string `json:"accountName"`
	Status      string `json:"accountStatus"`
	JoinedAt    string `json:"joinedAt"`
}

type Health struct {
	RealFollowers          int  `json:"realFollowers"`
	DaysSinceLastViolation int  `json:"daysSinceLastViolation"`
	FraudScore             int  `json:"fraudScore"`
	RiskScore              int  `json:"riskScore"`
	BorderlineContent      bool `json:"borderlineContent"`
}

type Result struct {
	Case        services.CaseView                   `json:"case"`
	Profile     Profile                             `json:"profile"`
	Health      Health                              `json:"health"`
	Eligibility *getverificationjourney.Eligibility `json:"eligibility"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, rawCaseId string) (Result, error) {
	caseId, err := uuid.Parse(rawCaseId)
	if err != nil {
		return Result{}, usersErrors.NotFound("That verification was not found.")
	}
	row, err := handler.Container.Client.VerificationCase.Get(ctx, caseId)
	if ent.IsNotFound(err) {
		return Result{}, usersErrors.NotFound("That verification was not found.")
	}
	if err != nil {
		return Result{}, err
	}
	result := Result{Case: services.ConvertCaseToView(row, true)}
	if profile, err := handler.Container.Client.Profile.Get(ctx, row.ProfileID); err == nil {
		result.Profile = Profile{Handle: profile.Handle, DisplayName: profile.DisplayName, ProfileType: string(profile.ProfileType)}
	}
	if account, err := usersservices.LoadActiveAccountSummary(ctx, row.AccountID); err == nil {
		result.Profile.AccountName, result.Profile.Status, result.Profile.JoinedAt = account.Name, account.Status, account.CreatedAt.UTC().Format("2006-01-02")
	}
	if signals, err := creatorservices.LoadProfileSignals(ctx, handler.Container, row.ProfileID); err == nil {
		result.Health = Health{RealFollowers: signals.RealFollowers, DaysSinceLastViolation: signals.DaysSinceLastViolation, FraudScore: signals.FraudScore, RiskScore: signals.RiskScore, BorderlineContent: signals.BorderlineContent}
	}
	if eligibility, err := handler.Container.Client.VerificationEligibility.Query().Where(verificationeligibility.ProfileID(row.ProfileID)).Only(ctx); err == nil {
		result.Eligibility = getverificationjourney.ConvertEligibility(eligibility)
	}
	return result, nil
}
