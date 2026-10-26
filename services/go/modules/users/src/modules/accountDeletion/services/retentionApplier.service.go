package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/actingprofile"
	"nantty/modules/users/src/generated/ent/privacysetting"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/generated/ent/shippingaddress"
	"nantty/modules/users/src/generated/ent/termsacceptance"
	"nantty/modules/users/src/generated/ent/userconsent"
	"nantty/modules/users/src/generated/ent/usernamechange"
	deletionevents "nantty/modules/users/src/modules/accountDeletion/events"
	retentionmodels "nantty/modules/users/src/modules/retention/models"
)

const (
	OutcomeRetained   = "retained"
	OutcomeDeleted    = "deleted"
	OutcomeAnonymized = "anonymized"
	OutcomeDeferred   = "deferred_until_retention_period"
	OutcomeDelegated  = "handled_by_owning_service"
)

var categoriesOwnedByOtherServices = map[string]bool{"orders": true, "financial": true, "messages": true, "analytics": true, "security_logs": true}

func DecideOutcome(policy retentionmodels.PolicySnapshot) string {
	switch {
	case categoriesOwnedByOtherServices[policy.Category]:
		return OutcomeDelegated
	case policy.Action == "retain":
		return OutcomeRetained
	case policy.RetentionDays != nil && *policy.RetentionDays > 0:
		return OutcomeDeferred
	case policy.Action == "delete":
		return OutcomeDeleted
	}
	return OutcomeAnonymized
}

func ApplyRetentionToUsersOwnedDataInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, snapshot []retentionmodels.PolicySnapshot) ([]deletionevents.AppliedStep, error) {
	steps := make([]deletionevents.AppliedStep, 0, len(snapshot))
	for _, policy := range snapshot {
		outcome := DecideOutcome(policy)
		if err := applyOutcome(ctx, tx, accountId, policy.Category, outcome); err != nil {
			return nil, fmt.Errorf("apply %s retention: %w", policy.Category, err)
		}
		steps = append(steps, deletionevents.AppliedStep{Category: policy.Category, Outcome: outcome})
	}
	return steps, nil
}

func applyOutcome(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, category, outcome string) error {
	if outcome != OutcomeDeleted && outcome != OutcomeAnonymized {
		return nil
	}
	switch category {
	case "account":
		return applyAccountCategory(ctx, tx, accountId, outcome)
	case "consents":
		return applyConsentsCategory(ctx, tx, accountId, outcome)
	case "marketing":
		_, err := tx.UserConsent.Delete().Where(userconsent.AccountID(accountId), userconsent.ConsentTypeEQ(userconsent.ConsentTypeMarketing)).Exec(ctx)
		return err
	}
	return nil
}

func applyAccountCategory(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, outcome string) error {
	if _, err := tx.ShippingAddress.Delete().Where(shippingaddress.AccountID(accountId)).Exec(ctx); err != nil {
		return err
	}
	if _, err := tx.PrivacySetting.Delete().Where(privacysetting.AccountID(accountId)).Exec(ctx); err != nil {
		return err
	}
	if _, err := tx.UsernameChange.Delete().Where(usernamechange.AccountID(accountId)).Exec(ctx); err != nil {
		return err
	}
	if _, err := tx.ActingProfile.Delete().Where(actingprofile.AccountID(accountId)).Exec(ctx); err != nil {
		return err
	}
	if outcome == OutcomeDeleted {
		_, err := tx.Profile.Delete().Where(profile.AccountID(accountId)).Exec(ctx)
		return err
	}
	return anonymizeProfiles(ctx, tx, accountId)
}

func anonymizeProfiles(ctx context.Context, tx *ent.Tx, accountId uuid.UUID) error {
	profiles, err := tx.Profile.Query().Where(profile.AccountID(accountId)).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range profiles {
		err := row.Update().SetHandle(AnonymizedHandleFor(row.ID)).SetDisplayName("").SetBio("").ClearWebsite().ClearAvatarMediaKey().ClearAvatarURL().
			ClearBannerMediaKey().ClearBannerURL().ClearCountryCode().SetIsPrivate(true).SetStatus(profile.StatusArchived).ClearCategories().Exec(ctx)
		if err != nil {
			return err
		}
	}
	return nil
}

func AnonymizedHandleFor(identifier uuid.UUID) string {
	return "deleted_" + identifier.String()[24:32]
}

func applyConsentsCategory(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, outcome string) error {
	if outcome == OutcomeAnonymized {
		rows, err := tx.UserConsent.Query().Where(userconsent.AccountID(accountId)).All(ctx)
		if err != nil {
			return err
		}
		for _, row := range rows {
			create := tx.UserConsent.Create().SetConsentType(row.ConsentType).SetStatus(row.Status).SetPolicyVersion(row.PolicyVersion).SetConsentedAt(row.ConsentedAt).SetSource("anonymized").SetCreatedAt(row.CreatedAt)
			if row.WithdrawnAt != nil {
				create.SetWithdrawnAt(*row.WithdrawnAt)
			}
			if err := create.Exec(ctx); err != nil {
				return err
			}
		}
	}
	if _, err := tx.UserConsent.Delete().Where(userconsent.AccountID(accountId)).Exec(ctx); err != nil {
		return err
	}
	_, err := tx.TermsAcceptance.Delete().Where(termsacceptance.AccountID(accountId)).Exec(ctx)
	return err
}
