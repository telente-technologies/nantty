package executedueaccountdeletions

import (
	"context"
	"encoding/json"
	"time"

	"nantty/modules/users/src/container"
	usersevents "nantty/modules/users/src/events"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/dataexportrequest"
	"nantty/modules/users/src/generated/ent/deletionrequest"
	deletionevents "nantty/modules/users/src/modules/accountDeletion/events"
	"nantty/modules/users/src/modules/accountDeletion/services"
	exportservices "nantty/modules/users/src/modules/dataExport/services"
	retentionmodels "nantty/modules/users/src/modules/retention/models"
	"nantty/platform/identityports"

	entsql "entgo.io/ent/dialect/sql"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Command) (int, error) {
	executed := 0
	for range 10 {
		worked, err := handler.executeNextDueRequest(ctx)
		if err != nil || !worked {
			return executed, err
		}
		executed++
	}
	return executed, nil
}

func (handler Handler) executeNextDueRequest(ctx context.Context) (bool, error) {
	worked := false
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := handler.Container.Now()
		due, err := tx.DeletionRequest.Query().Where(deletionrequest.StatusEQ(deletionrequest.StatusPending), deletionrequest.ScheduledForLTE(now)).
			Order(ent.Asc(deletionrequest.FieldID)).Limit(1).ForUpdate(entsql.WithLockAction(entsql.SkipLocked)).First(ctx)
		if ent.IsNotFound(err) {
			return nil
		}
		if err != nil {
			return err
		}
		worked = true
		var snapshot []retentionmodels.PolicySnapshot
		if err := json.Unmarshal(due.RetentionSnapshot, &snapshot); err != nil {
			return err
		}
		finalEmail := handler.finalEmailOf(ctx, due)
		steps, err := handler.executeRequest(ctx, tx, due, snapshot)
		if err != nil {
			return err
		}
		if err := due.Update().SetStatus(deletionrequest.StatusExecuted).SetExecutedAt(now).Exec(ctx); err != nil {
			return err
		}
		return usersevents.EnqueueOutboxEventInTransaction(ctx, tx, deletionevents.AccountDeletionExecutedType, due.AccountID.String(), now, deletionevents.AccountDeletionExecutedData{
			AccountId: due.AccountID.String(), ExecutedAt: now.UTC().Format(time.RFC3339), RetentionPolicy: snapshot, AppliedSteps: steps, FinalEmail: finalEmail, ReferenceId: due.ID.String(),
		})
	})
	return worked, err
}

func (handler Handler) executeRequest(ctx context.Context, tx *ent.Tx, due *ent.DeletionRequest, snapshot []retentionmodels.PolicySnapshot) ([]deletionevents.AppliedStep, error) {
	accountOutcome := accountOutcomeOf(snapshot)
	removesIdentity := accountOutcome == services.OutcomeDeleted || accountOutcome == services.OutcomeAnonymized
	if removesIdentity {
		if err := handler.deleteExportArchives(ctx, tx, due); err != nil {
			return nil, err
		}
	}
	steps, err := services.ApplyRetentionToUsersOwnedDataInTransaction(ctx, tx, due.AccountID, snapshot)
	if err != nil {
		return nil, err
	}
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return nil, err
	}
	if removesIdentity {
		if err := directory.RenameAccountUsername(ctx, due.AccountID, services.AnonymizedHandleFor(due.AccountID)); err != nil {
			return nil, err
		}
	}
	return steps, directory.DeactivateAccountAndRevokeSessions(ctx, due.AccountID)
}

func (handler Handler) deleteExportArchives(ctx context.Context, tx *ent.Tx, due *ent.DeletionRequest) error {
	exports, err := tx.DataExportRequest.Query().Where(dataexportrequest.AccountID(due.AccountID)).All(ctx)
	if err != nil {
		return err
	}
	for _, export := range exports {
		if export.ObjectKey == nil {
			continue
		}
		store, err := exportservices.ObjectStoreFor(ctx, handler.Container.Settings.Privacy)
		if err != nil {
			return err
		}
		if err := store.Delete(ctx, *export.ObjectKey); err != nil {
			return err
		}
	}
	_, err = tx.DataExportRequest.Delete().Where(dataexportrequest.AccountID(due.AccountID)).Exec(ctx)
	return err
}

func accountOutcomeOf(snapshot []retentionmodels.PolicySnapshot) string {
	for _, policy := range snapshot {
		if policy.Category == "account" {
			return services.DecideOutcome(policy)
		}
	}
	return services.OutcomeRetained
}

func (handler Handler) finalEmailOf(ctx context.Context, due *ent.DeletionRequest) string {
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return ""
	}
	summary, found, err := directory.FindAccountSummary(ctx, due.AccountID)
	if err != nil || !found || summary.Email == nil {
		return ""
	}
	return *summary.Email
}
