package services

import (
	"context"

	"zudomart/modules/users/src/container"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/profilesignal"
	"zudomart/platform/identityports"
)

const suggestionBatchSize = 100

type SuggestionScheduler struct {
	Container *container.Container
}

func (scheduler SuggestionScheduler) RunOnce(ctx context.Context) error {
	pending, err := scheduler.Container.Client.ProfileSignal.Query().Where(profilesignal.CheckmarkSuggestedAtIsNil()).Order(ent.Asc(profilesignal.FieldID)).Limit(suggestionBatchSize).All(ctx)
	if err != nil {
		return err
	}
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return err
	}
	for _, signals := range pending {
		if err := scheduler.suggestIfEligible(ctx, directory, signals); err != nil {
			return err
		}
	}
	return nil
}

func (scheduler SuggestionScheduler) suggestIfEligible(ctx context.Context, directory identityports.AccountDirectory, signals *ent.ProfileSignal) error {
	profile, err := scheduler.Container.Client.Profile.Get(ctx, signals.ProfileID)
	if err != nil {
		return err
	}
	account, found, err := directory.FindAccountSummary(ctx, profile.AccountID)
	if err != nil || !found || account.Status != "active" {
		return err
	}
	suggestions, err := BuildSuggestionsForProfile(ctx, scheduler.Container, profile, account)
	if err != nil || len(suggestions) == 0 || !suggestions[0].Eligible || suggestions[0].Dismissed {
		return err
	}
	suggestion := suggestions[0]
	price := LoadPricingRules(ctx).BlueMonthlyPrice
	if suggestion.Color == "gold" {
		price = LoadPricingRules(ctx).GoldOnlyMonthlyPrice
	}
	reasons := make([]string, 0, len(suggestion.Rules))
	for _, rule := range suggestion.Rules {
		reasons = append(reasons, rule.Label)
	}
	return scheduler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := scheduler.Container.Now()
		if err := tx.ProfileSignal.UpdateOne(signals).SetCheckmarkSuggestedAt(now).Exec(ctx); err != nil {
			return err
		}
		notice := NoticeBase(profile, suggestion.Color)
		notice.Reasons, notice.Price = reasons, &Price{AmountMinor: price.AmountMinor, Currency: price.Currency}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, "checkmark.suggested", notice.AccountId, now, notice)
	})
}
