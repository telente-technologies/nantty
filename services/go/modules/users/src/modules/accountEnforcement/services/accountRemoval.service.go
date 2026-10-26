package services

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/accountremoval"
	deletionevents "nantty/modules/users/src/modules/accountDeletion/events"
	deletionservices "nantty/modules/users/src/modules/accountDeletion/services"
	retentionmodels "nantty/modules/users/src/modules/retention/models"
	"nantty/platform/identityports"
)

const financialRecordRetentionDays = 2555

type RemovalOutcome struct {
	Removed           []string  `json:"removed"`
	AnonymizedRecords []string  `json:"anonymizedRecords"`
	RetainedUntil     time.Time `json:"retainedUntil"`
}

func removalPolicySnapshot() []retentionmodels.PolicySnapshot {
	retained := financialRecordRetentionDays
	snapshot := make([]retentionmodels.PolicySnapshot, 0, len(retentionmodels.Categories))
	for _, category := range retentionmodels.Categories {
		policy := retentionmodels.PolicySnapshot{Category: category, Action: "delete"}
		if category == "orders" || category == "financial" || category == "security_logs" {
			policy.Action, policy.RetentionDays = "anonymize", &retained
		}
		snapshot = append(snapshot, policy)
	}
	return snapshot
}

func RemoveAccountDataAndAnonymize(ctx context.Context, application *container.Container, accountId uuid.UUID, username, finalEmail, trigger, reason, deletedBy string) (RemovalOutcome, error) {
	now := application.Now()
	outcome := RemovalOutcome{Removed: []string{"profile", "posts", "media", "messages", "addresses", "consents"}, AnonymizedRecords: []string{"orders", "payments", "ledger"}, RetainedUntil: now.AddDate(0, 0, financialRecordRetentionDays)}
	snapshot := removalPolicySnapshot()
	enforcement, err := identityports.Default.AccountEnforcement()
	if err != nil {
		return outcome, err
	}
	err = application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		steps, err := deletionservices.ApplyRetentionToUsersOwnedDataInTransaction(ctx, tx, accountId, snapshot)
		if err != nil {
			return err
		}
		encodedSteps, _ := json.Marshal(steps)
		if err := tx.AccountRemoval.Create().SetAccountID(accountId).SetUsername(username).SetTrigger(accountremoval.Trigger(trigger)).SetReason(reason).SetDeletedBy(deletedBy).SetAppliedSteps(encodedSteps).SetRetainedUntil(outcome.RetainedUntil).Exec(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, deletionevents.AccountDeletionExecutedType, accountId.String(), now, deletionevents.AccountDeletionExecutedData{
			AccountId: accountId.String(), ExecutedAt: now.UTC().Format(time.RFC3339), RetentionPolicy: snapshot, AppliedSteps: steps, FinalEmail: finalEmail, ReferenceId: accountId.String(),
		})
	})
	if err != nil {
		return outcome, err
	}
	return outcome, enforcement.MarkAccountDeleted(ctx, accountId, deletionservices.AnonymizedHandleFor(accountId))
}
