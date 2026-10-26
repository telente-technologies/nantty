package services

import (
	"context"
	"time"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/userconsent"
	"nantty/modules/users/src/modules/consents/models"
)

func subjectPredicate(subject models.Subject) func(*ent.UserConsentQuery) *ent.UserConsentQuery {
	return func(query *ent.UserConsentQuery) *ent.UserConsentQuery {
		if subject.AccountId != nil {
			return query.Where(userconsent.AccountID(*subject.AccountId))
		}
		return query.Where(userconsent.DeviceID(subject.DeviceId), userconsent.AccountIDIsNil())
	}
}

func LatestConsentRow(ctx context.Context, client *ent.Client, subject models.Subject, consentType string) (*ent.UserConsent, error) {
	row, err := subjectPredicate(subject)(client.UserConsent.Query()).
		Where(userconsent.ConsentTypeEQ(userconsent.ConsentType(consentType))).
		Order(ent.Desc(userconsent.FieldID)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func ReadConsentStates(ctx context.Context, client *ent.Client, subject models.Subject) ([]models.ConsentState, error) {
	states := []models.ConsentState{{ConsentType: models.TypeEssential, Status: models.StatusGranted}}
	for _, consentType := range models.OptionalConsentTypes {
		row, err := LatestConsentRow(ctx, client, subject, consentType)
		if err != nil {
			return nil, err
		}
		state := models.ConsentState{ConsentType: consentType, Status: models.StatusUndecided}
		if row != nil {
			decidedAt := row.ConsentedAt
			if row.WithdrawnAt != nil {
				decidedAt = *row.WithdrawnAt
			}
			state.Status, state.PolicyVersion, state.DecidedAt = string(row.Status), row.PolicyVersion, &decidedAt
		}
		states = append(states, state)
	}
	return states, nil
}

func RecordDecisionsInTransaction(ctx context.Context, tx *ent.Tx, subject models.Subject, decisions []models.Decision, policyVersion string, metadata models.RequestMetadata, decidedAt time.Time) ([]models.DecisionChange, error) {
	var changes []models.DecisionChange
	for _, decision := range decisions {
		if decision.ConsentType == models.TypeEssential {
			continue
		}
		latest, err := LatestConsentRow(ctx, tx.Client(), subject, decision.ConsentType)
		if err != nil {
			return nil, err
		}
		if latest != nil && (latest.Status == userconsent.StatusGranted) == decision.Granted {
			continue
		}
		create := tx.UserConsent.Create().
			SetConsentType(userconsent.ConsentType(decision.ConsentType)).SetPolicyVersion(policyVersion).SetConsentedAt(decidedAt).
			SetIPAddress(metadata.IpAddress).SetUserAgent(metadata.UserAgent).SetSource(metadata.Source)
		if subject.AccountId != nil {
			create.SetAccountID(*subject.AccountId)
		} else {
			create.SetDeviceID(subject.DeviceId)
		}
		if decision.Granted {
			create.SetStatus(userconsent.StatusGranted)
		} else {
			create.SetStatus(userconsent.StatusWithdrawn).SetWithdrawnAt(decidedAt)
		}
		if err := create.Exec(ctx); err != nil {
			return nil, err
		}
		changes = append(changes, models.DecisionChange{ConsentType: decision.ConsentType, Granted: decision.Granted})
	}
	return changes, nil
}

func NeedsRenewal(states []models.ConsentState, currentPrivacyVersion string) bool {
	for _, state := range states {
		if state.Status != models.StatusUndecided && state.ConsentType != models.TypeEssential && state.PolicyVersion != currentPrivacyVersion {
			return true
		}
	}
	return false
}
