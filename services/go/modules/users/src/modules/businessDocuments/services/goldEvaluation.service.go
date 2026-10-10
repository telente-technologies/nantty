package services

import (
	"context"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersevents "zudomart/modules/users/src/events"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/businessdocument"
	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/modules/users/src/generated/ent/profilecheckmark"
	"zudomart/modules/users/src/generated/ent/profilesignal"
	businessevents "zudomart/modules/users/src/modules/businessDocuments/events"
	checkmarkservices "zudomart/modules/users/src/modules/checkmarks/services"
)

func StoreProfileOf(ctx context.Context, client *ent.Client, accountId uuid.UUID) (*ent.Profile, error) {
	row, err := client.Profile.Query().Where(profile.AccountID(accountId), profile.KindEQ(profile.KindBusiness), profile.StatusEQ(profile.StatusActive)).Order(ent.Asc(profile.FieldCreatedAt)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func AllDocumentsApproved(ctx context.Context, client *ent.Client, accountId uuid.UUID) (bool, error) {
	count, err := client.BusinessDocument.Query().Where(businessdocument.AccountID(accountId), businessdocument.IsCurrent(true), businessdocument.StatusEQ(businessdocument.StatusApproved)).Count(ctx)
	return count >= len(DocumentKindOrder), err
}

func EveryKindApprovedOnce(ctx context.Context, client *ent.Client, accountId uuid.UUID) (bool, error) {
	kinds, err := client.BusinessDocument.Query().Where(businessdocument.AccountID(accountId), businessdocument.StatusEQ(businessdocument.StatusApproved)).GroupBy(businessdocument.FieldKind).Strings(ctx)
	return len(kinds) >= len(DocumentKindOrder), err
}

func EnqueueVerificationRevokedInTransaction(ctx context.Context, tx *ent.Tx, now time.Time, accountId uuid.UUID, documentKind, reason string) error {
	store, err := StoreProfileOf(ctx, tx.Client(), accountId)
	if err != nil {
		return err
	}
	data := businessevents.VerificationRevokedData{AccountId: accountId.String(), DocumentKind: documentKind, Reason: reason}
	if store != nil {
		data.ProfileId = store.ID.String()
	}
	return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, businessevents.BusinessVerificationRevokedType, accountId.String(), now, data)
}

func GoldGrantedFor(ctx context.Context, client *ent.Client, profileId uuid.UUID) (bool, error) {
	return client.ProfileCheckmark.Query().Where(profilecheckmark.ProfileID(profileId), profilecheckmark.ColorEQ(profilecheckmark.ColorGold), profilecheckmark.StatusEQ(profilecheckmark.StatusVerified)).Exist(ctx)
}

func EvaluateGoldFromApprovedDocuments(ctx context.Context, application *container.Container, tx *ent.Tx, accountId uuid.UUID) error {
	approved, err := AllDocumentsApproved(ctx, tx.Client(), accountId)
	if err != nil || !approved {
		return err
	}
	store, err := StoreProfileOf(ctx, tx.Client(), accountId)
	if err != nil {
		return err
	}
	now := application.Now()
	granted := false
	if store != nil {
		signals, err := tx.ProfileSignal.Query().Where(profilesignal.ProfileID(store.ID)).Only(ctx)
		paid := err == nil && signals.SellerPlan != profilesignal.SellerPlanFREE
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		if paid {
			if _, err := checkmarkservices.SetProfileCheckmarkInTransaction(ctx, tx, now, checkmarkservices.CheckmarkChange{Profile: store, Color: profilecheckmark.ColorGold, Status: profilecheckmark.StatusVerified, Source: profilecheckmark.SourceBusinessDocuments}); err != nil {
				return err
			}
			granted = true
		}
	}
	profileId := ""
	if store != nil {
		profileId = store.ID.String()
	}
	return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, businessevents.BusinessVerificationApprovedType, accountId.String(), now, businessevents.VerificationApprovedData{
		AccountId: accountId.String(), ProfileId: profileId, GoldEligible: true, GoldCheckmarkGranted: granted,
	})
}
