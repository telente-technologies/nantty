package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/privacysetting"
	consentmodels "nantty/modules/users/src/modules/consents/models"
	consentservices "nantty/modules/users/src/modules/consents/services"
	privacyevents "nantty/modules/users/src/modules/privacySettings/events"
)

func RunAccountDecisionTransaction(ctx context.Context, c *container.Container, work func(tx *ent.Tx) error) error {
	err := c.RunInTransaction(ctx, work)
	if ent.IsConstraintError(err) {
		return c.RunInTransaction(ctx, work)
	}
	return err
}

func ApplyAccountDecisionsInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, decisions []consentmodels.Decision, policyVersion string, metadata consentmodels.RequestMetadata, decidedAt time.Time) ([]consentmodels.DecisionChange, error) {
	subject := consentservices.AccountSubject(accountId)
	changes, err := consentservices.RecordDecisionsInTransaction(ctx, tx, subject, decisions, policyVersion, metadata, decidedAt)
	if err != nil || len(changes) == 0 {
		return changes, err
	}
	for _, change := range changes {
		eventType := privacyevents.ConsentWithdrawnType
		if change.Granted {
			eventType = privacyevents.ConsentGrantedType
		}
		data := privacyevents.ConsentChangedData{AccountId: accountId.String(), ConsentType: change.ConsentType, PolicyVersion: policyVersion, OccurredAt: decidedAt.UTC().Format(time.RFC3339)}
		if err := usersevents.EnqueueOutboxEventInTransaction(ctx, tx, eventType, accountId.String(), decidedAt, data); err != nil {
			return nil, err
		}
	}
	return changes, refreshMaterializedSettingsInTransaction(ctx, tx, accountId, policyVersion, decidedAt)
}

func refreshMaterializedSettingsInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, policyVersion string, now time.Time) error {
	states, err := consentservices.ReadConsentStates(ctx, tx.Client(), consentservices.AccountSubject(accountId))
	if err != nil {
		return err
	}
	granted := map[string]bool{}
	for _, state := range states {
		granted[state.ConsentType] = state.Status == consentmodels.StatusGranted
	}
	existing, err := tx.PrivacySetting.Query().Where(privacysetting.AccountID(accountId)).ForUpdate().Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return err
	}
	if existing == nil {
		err = tx.PrivacySetting.Create().SetAccountID(accountId).SetAnalytics(granted[consentmodels.TypeAnalytics]).
			SetPersonalization(granted[consentmodels.TypePersonalization]).SetPersonalizedAds(granted[consentmodels.TypeAdvertising]).
			SetMarketing(granted[consentmodels.TypeMarketing]).SetPolicyVersion(policyVersion).Exec(ctx)
	} else {
		err = existing.Update().SetAnalytics(granted[consentmodels.TypeAnalytics]).SetPersonalization(granted[consentmodels.TypePersonalization]).
			SetPersonalizedAds(granted[consentmodels.TypeAdvertising]).SetMarketing(granted[consentmodels.TypeMarketing]).SetPolicyVersion(policyVersion).Exec(ctx)
	}
	if err != nil {
		return err
	}
	return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, privacyevents.PrivacySettingsChangedType, accountId.String(), now, privacyevents.PrivacySettingsChangedData{
		AccountId: accountId.String(), Personalization: granted[consentmodels.TypePersonalization], PersonalizedAds: granted[consentmodels.TypeAdvertising],
		Marketing: granted[consentmodels.TypeMarketing], Analytics: granted[consentmodels.TypeAnalytics], ChangedAt: now.UTC().Format(time.RFC3339), PolicyVersion: policyVersion,
	})
}
