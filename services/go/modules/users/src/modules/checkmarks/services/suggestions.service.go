package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/businessdocument"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	"nantty/modules/users/src/generated/ent/suggestiondismissal"
	creatorservices "nantty/modules/users/src/modules/creatorProgram/services"
	"nantty/platform/identityports"
)

type Rule struct {
	Label string `json:"label"`
	Met   bool   `json:"met"`
}

type Suggestion struct {
	Color     string `json:"color"`
	Eligible  bool   `json:"eligible"`
	Dismissed bool   `json:"dismissed"`
	Headline  string `json:"headline"`
	Detail    string `json:"detail"`
	Rules     []Rule `json:"rules"`
}

func BusinessDocumentsAllApproved(ctx context.Context, application *container.Container, accountId uuid.UUID) (bool, error) {
	approved, err := application.Client.BusinessDocument.Query().Where(businessdocument.AccountID(accountId), businessdocument.IsCurrent(true), businessdocument.StatusEQ(businessdocument.StatusApproved)).Count(ctx)
	return approved >= 3, err
}

func HasLiveCheckmark(ctx context.Context, application *container.Container, profileId uuid.UUID) (bool, error) {
	row, err := application.Client.ProfileCheckmark.Query().Where(profilecheckmark.ProfileID(profileId)).Only(ctx)
	if ent.IsNotFound(err) {
		return false, nil
	}
	return err == nil && row.Status != profilecheckmark.StatusRevoked && row.Status != profilecheckmark.StatusExpired, err
}

func BuildSuggestionsForProfile(ctx context.Context, application *container.Container, acting *ent.Profile, account identityports.AccountSummary) ([]Suggestion, error) {
	color := ColorForProfileType(acting.ProfileType)
	if color == profilecheckmark.ColorBlack {
		return []Suggestion{}, nil
	}
	if live, err := HasLiveCheckmark(ctx, application, acting.ID); err != nil || live {
		return []Suggestion{}, err
	}
	signals, err := creatorservices.LoadProfileSignals(ctx, application, acting.ID)
	if err != nil {
		return nil, err
	}
	rules := LoadSuggestionRules(ctx)
	var lines []Rule
	if color == profilecheckmark.ColorBlue {
		lines = blueRules(rules, signals, account, int(application.Now().Sub(account.CreatedAt).Hours()/24))
	} else {
		documentsApproved, err := BusinessDocumentsAllApproved(ctx, application, acting.AccountID)
		if err != nil {
			return nil, err
		}
		lines = goldRules(rules, signals, documentsApproved)
	}
	eligible := true
	for _, line := range lines {
		eligible = eligible && line.Met
	}
	dismissed, err := application.Client.SuggestionDismissal.Query().Where(suggestiondismissal.ProfileID(acting.ID), suggestiondismissal.ColorEQ(suggestiondismissal.Color(color))).Exist(ctx)
	if err != nil {
		return nil, err
	}
	suggestion := Suggestion{Color: string(color), Eligible: eligible, Dismissed: dismissed, Rules: lines, Headline: "You may qualify for a verified checkmark", Detail: "Keep going. This list updates automatically as you grow."}
	if eligible {
		suggestion.Detail = fmt.Sprintf("You meet the requirements for the %s checkmark.", color)
	}
	return []Suggestion{suggestion}, nil
}

func blueRules(rules SuggestionRules, signals *ent.ProfileSignal, account identityports.AccountSummary, ageDays int) []Rule {
	return []Rule{
		{Label: "ID verified", Met: signals.IDVerified || !rules.Blue.RequiresIdVerified},
		{Label: fmt.Sprintf("Account at least %d days old", rules.Blue.MinimumAccountAgeDays), Met: ageDays >= rules.Blue.MinimumAccountAgeDays},
		{Label: fmt.Sprintf("At least %d real followers", rules.Blue.MinimumRealFollowers), Met: signals.RealFollowers >= rules.Blue.MinimumRealFollowers},
		{Label: fmt.Sprintf("No violations in the last %d days", rules.Blue.NoViolationsInDays), Met: signals.DaysSinceLastViolation >= rules.Blue.NoViolationsInDays},
	}
}

func goldRules(rules SuggestionRules, signals *ent.ProfileSignal, documentsApproved bool) []Rule {
	return []Rule{
		{Label: "Business verification passed", Met: documentsApproved || !rules.Gold.RequiresBusinessVerification},
		{Label: "Active store or brand page", Met: signals.HasActiveStoreOrBrandPage || !rules.Gold.RequiresActiveStoreOrBrandPage},
		{Label: fmt.Sprintf("At least %d completed orders", rules.Gold.MinimumCompletedOrders), Met: signals.CompletedOrders >= rules.Gold.MinimumCompletedOrders},
		{Label: fmt.Sprintf("Success rate at least %d%%", rules.Gold.MinimumSuccessRatePercent), Met: signals.SuccessRatePercent >= rules.Gold.MinimumSuccessRatePercent},
	}
}
