package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/paymentintent"
	"nantty/modules/payments/src/generated/ent/providermovement"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
)

const (
	movementResendAfter  = 2 * time.Minute
	movementConfirmAfter = 30 * time.Second
)

func (gateway *PaymentGateway) applyMovementOutcome(ctx context.Context, reference string, outcome interfaces.ProviderOutcome, failureReason, providerTransferId string) error {
	return databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		client := gateway.Container.Client(transaction)
		movement, err := client.ProviderMovement.Query().Where(providermovement.Reference(reference)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if movement.Status == providermovement.StatusSucceeded || movement.Status == providermovement.StatusFailed || movement.Status == providermovement.StatusCancelled {
			return nil
		}
		handler, err := gateway.movementHandler(movement.Kind)
		if err != nil {
			return err
		}
		now := gateway.Container.Now().UTC()
		update := movement.Update().SetFinishedAt(now).AddVersion(1)
		if providerTransferId != "" {
			update.SetProviderTransferID(providerTransferId)
		}
		if outcome == interfaces.OutcomeSucceeded {
			updated, err := update.SetStatus(providermovement.StatusSucceeded).SetFailureReason("").Save(ctx)
			if err != nil {
				return err
			}
			if err := gateway.postMovementAssetLegs(ctx, transaction, updated); err != nil {
				return err
			}
			if err := handler.HandleMovementSucceeded(ctx, transaction, ConvertMovementToFinished(updated, "")); err != nil {
				return err
			}
			return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "providerMovement.succeeded", updated.Reference, now, movementEventData(updated))
		}
		updated, err := update.SetStatus(providermovement.StatusFailed).SetFailureReason(truncateReason(failureReason)).Save(ctx)
		if err != nil {
			return err
		}
		if err := handler.HandleMovementFailed(ctx, transaction, ConvertMovementToFinished(updated, failureReason)); err != nil {
			return err
		}
		gateway.Container.Resources.Logger.ErrorContext(ctx, "provider movement failed", "reference", updated.Reference, "kind", updated.Kind, "reason", failureReason)
		return gateway.Container.Outbox.EnqueueInTransaction(ctx, transaction, "providerMovement.failed", updated.Reference, now, movementEventData(updated))
	})
}

func (gateway *PaymentGateway) postMovementAssetLegs(ctx context.Context, transaction *sql.Tx, movement *ent.ProviderMovement) error {
	source := ledgermodels.PlatformProviderBalanceAccount(movement.Provider, movement.Currency)
	if movement.FromWalletRef != "" {
		source = ledgermodels.ProviderWalletMirrorAccount(movement.Provider, movement.FromWalletRef, movement.Currency)
	}
	destination := ledgermodels.PlatformProviderBalanceAccount(movement.Provider, movement.Currency)
	if !movement.ToPlatform {
		destination = ledgermodels.ProviderWalletMirrorAccount(movement.Provider, movement.ToWalletRef, movement.Currency)
	}
	_, err := gateway.Container.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{
		Reference: "movement-assets:" + movement.Reference, Kind: "providerMovement.assets", ExternalReference: movement.Reference,
		Description: "Money moved at the provider (" + movement.Kind + ")", Metadata: map[string]any{"movementId": movement.ID.String(), "kind": movement.Kind},
		Lines: []ledgermodels.JournalLineRequest{
			{Account: destination, Direction: ledgermodels.Debit, AmountMinor: movement.AmountMinor},
			{Account: source, Direction: ledgermodels.Credit, AmountMinor: movement.AmountMinor},
		},
	})
	return err
}

func movementEventData(movement *ent.ProviderMovement) map[string]any {
	return map[string]any{
		"movementId": movement.ID.String(), "reference": movement.Reference, "kind": movement.Kind, "status": string(movement.Status), "subjectId": movement.SubjectID,
		"fromUserId": movement.FromUserID, "toUserId": movement.ToUserID, "toPlatform": movement.ToPlatform, "failureReason": movement.FailureReason,
		"amount": map[string]any{"amountMinor": movement.AmountMinor, "currency": movement.Currency},
	}
}

func (gateway *PaymentGateway) ProcessDueMovements(ctx context.Context, limit int) int {
	gateway.unblockMovements(ctx, limit)
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	now := gateway.Container.Now().UTC()
	due, err := client.ProviderMovement.Query().Where(providermovement.Or(
		providermovement.And(providermovement.StatusEQ(providermovement.StatusPending), providermovement.BlockedOn(""),
			providermovement.Or(providermovement.NotBeforeIsNil(), providermovement.NotBeforeLTE(now))),
		providermovement.And(providermovement.StatusEQ(providermovement.StatusProcessing), providermovement.SentAtLT(now.Add(-movementConfirmAfter))),
	)).Order(ent.Asc(providermovement.FieldCreatedAt)).Limit(limit).All(ctx)
	if err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "could not list due provider movements", "error", err)
		return 0
	}
	for _, movement := range due {
		var err error
		if movement.Status == providermovement.StatusPending {
			err = gateway.SendMovement(ctx, movement.Reference)
		} else {
			err = gateway.ConfirmMovement(ctx, movement.Reference, "")
		}
		if err != nil {
			gateway.Container.Resources.Logger.WarnContext(ctx, "provider movement did not finish; it is retried", "reference", movement.Reference, "error", err)
		}
	}
	return len(due)
}

const maximumUnblockPages = 20

func (gateway *PaymentGateway) unblockMovements(ctx context.Context, limit int) {
	client := gateway.Container.Client(gateway.Container.Resources.Database)
	var last *ent.ProviderMovement
	for page := 0; page < maximumUnblockPages; page++ {
		query := client.ProviderMovement.Query().Where(providermovement.StatusEQ(providermovement.StatusPending), providermovement.BlockedOnNEQ(""))
		if last != nil {
			query = query.Where(providermovement.Or(providermovement.CreatedAtGT(last.CreatedAt), providermovement.And(providermovement.CreatedAtEQ(last.CreatedAt), providermovement.IDGT(last.ID))))
		}
		blocked, err := query.Order(ent.Asc(providermovement.FieldCreatedAt), ent.Asc(providermovement.FieldID)).Limit(limit).All(ctx)
		if err != nil || len(blocked) == 0 {
			return
		}
		settled := gateway.settledReferencesAmong(ctx, client, blocked)
		for _, movement := range blocked {
			gateway.unblockMovement(ctx, client, movement, settled)
		}
		if len(blocked) < limit {
			return
		}
		last = blocked[len(blocked)-1]
	}
}

func (gateway *PaymentGateway) settledReferencesAmong(ctx context.Context, client *ent.Client, blocked []*ent.ProviderMovement) map[string]bool {
	references := []string{}
	for _, movement := range blocked {
		if kind, subject, _ := strings.Cut(movement.BlockedOn, ":"); kind == "settlement" {
			references = append(references, subject)
		}
	}
	settled := map[string]bool{}
	if len(references) == 0 {
		return settled
	}
	intents, err := client.PaymentIntent.Query().Where(paymentintent.ReferenceIn(references...), paymentintent.ProviderSettledAtNotNil()).Select(paymentintent.FieldReference).Strings(ctx)
	if err != nil {
		return settled
	}
	for _, reference := range intents {
		settled[reference] = true
	}
	return settled
}

func (gateway *PaymentGateway) unblockMovement(ctx context.Context, client *ent.Client, movement *ent.ProviderMovement, settled map[string]bool) {
	kind, subject, _ := strings.Cut(movement.BlockedOn, ":")
	update := client.ProviderMovement.Update().Where(providermovement.ID(movement.ID), providermovement.Version(movement.Version)).AddVersion(1).SetBlockedOn("")
	switch kind {
	case "settlement":
		if !settled[subject] {
			return
		}
		if movement.ToUserID != "" && movement.ToWalletRef == "" {
			update.SetBlockedOn("wallet:" + movement.ToUserID)
		}
	case "wallet":
		wallet, err := gateway.FindProviderWallet(ctx, gateway.Container.Resources.Database, subject)
		if errors.Is(err, ErrProviderWalletMissing) && movement.Kind == models.MovementEscrowFundIn {
			wallet, err = gateway.EnsureProviderWalletForCardBuyer(ctx, subject)
		}
		if err != nil {
			return
		}
		update.SetToBarterID(wallet.BarterID).SetToWalletRef(wallet.AccountRef)
	default:
		return
	}
	if err := update.Exec(ctx); err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "could not unblock a provider movement", "reference", movement.Reference, "error", err)
	}
}

func (gateway *PaymentGateway) CancelPendingMovementInTransaction(ctx context.Context, transaction *sql.Tx, reference, reason string) (bool, error) {
	client := gateway.Container.Client(transaction)
	movement, err := client.ProviderMovement.Query().Where(providermovement.Reference(reference)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return false, nil
	}
	if err != nil || movement.Status != providermovement.StatusPending {
		return false, err
	}
	return true, movement.Update().SetStatus(providermovement.StatusCancelled).SetFailureReason(truncateReason(reason)).SetFinishedAt(gateway.Container.Now().UTC()).AddVersion(1).Exec(ctx)
}

func (gateway *PaymentGateway) FindMovementBySubject(ctx context.Context, executor databases.ExecutorQuerier, kind, subjectId string) (*ent.ProviderMovement, error) {
	movement, err := gateway.Container.Client(executor).ProviderMovement.Query().Where(providermovement.Kind(kind), providermovement.SubjectID(subjectId)).
		Order(ent.Desc(providermovement.FieldCreatedAt)).First(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return movement, err
}

func (gateway *PaymentGateway) CountMovementsBySubject(ctx context.Context, executor databases.ExecutorQuerier, kind, subjectId string) (int, error) {
	return gateway.Container.Client(executor).ProviderMovement.Query().Where(providermovement.Kind(kind), providermovement.SubjectID(subjectId)).Count(ctx)
}

func (gateway *PaymentGateway) HasOpenMovement(ctx context.Context, executor databases.ExecutorQuerier, kind, userId string) (bool, error) {
	return gateway.Container.Client(executor).ProviderMovement.Query().Where(providermovement.Kind(kind), providermovement.UserID(userId),
		providermovement.StatusIn(providermovement.StatusPending, providermovement.StatusProcessing)).Exist(ctx)
}
