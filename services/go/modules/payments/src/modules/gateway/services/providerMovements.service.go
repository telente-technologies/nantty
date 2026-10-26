package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/providermovement"
	"nantty/modules/payments/src/integrations/providerHttp"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
)

func (gateway *PaymentGateway) EnqueueMovementInTransaction(ctx context.Context, transaction *sql.Tx, request models.MovementRequest) (*ent.ProviderMovement, error) {
	if request.AmountMinor <= 0 || request.Kind == "" || (request.FromUserId == "" && request.ToUserId == "") || (request.ToPlatform && request.ToUserId != "") {
		return nil, fmt.Errorf("invalid provider movement %q", request.Kind)
	}
	if request.Reference == "" {
		request.Reference = models.NewMovementReference(request.Kind)
	}
	client := gateway.Container.Client(transaction)
	if existing, err := client.ProviderMovement.Query().Where(providermovement.Reference(request.Reference)).Only(ctx); err == nil {
		return existing, nil
	} else if !ent.IsNotFound(err) {
		return nil, err
	}
	create := client.ProviderMovement.Create().SetReference(request.Reference).SetProvider(gateway.walletProviderName()).SetKind(request.Kind).
		SetSubjectID(truncate(request.SubjectId, 120)).SetUserID(request.UserId).SetFromUserID(request.FromUserId).SetToUserID(request.ToUserId).
		SetToPlatform(request.ToPlatform || request.ToUserId == "").SetAmountMinor(request.AmountMinor).SetCurrency(request.Currency).
		SetBlockedOn(request.BlockedOn).SetNillableNotBefore(request.NotBefore).SetCreatedAt(gateway.Container.Now())
	if request.FromUserId != "" {
		source, err := gateway.FindProviderWallet(ctx, transaction, request.FromUserId)
		if err != nil {
			return nil, err
		}
		create.SetFromWalletRef(source.AccountRef)
	}
	if request.ToUserId != "" {
		destination, err := gateway.FindProviderWallet(ctx, transaction, request.ToUserId)
		switch {
		case errors.Is(err, ErrProviderWalletMissing) && request.BlockedOn == "":
			create.SetBlockedOn("wallet:" + request.ToUserId)
		case err != nil && !errors.Is(err, ErrProviderWalletMissing):
			return nil, err
		case err == nil:
			create.SetToBarterID(destination.BarterID).SetToWalletRef(destination.AccountRef)
		}
	}
	encoded, err := json.Marshal(nonNilMap(request.Metadata))
	if err != nil {
		return nil, err
	}
	return create.SetMetadata(encoded).Save(ctx)
}

func nonNilMap(values map[string]any) map[string]any {
	if values == nil {
		return map[string]any{}
	}
	return values
}

func (gateway *PaymentGateway) SendMovement(ctx context.Context, reference string) error {
	movement, err := gateway.Container.Client(gateway.Container.Resources.Database).ProviderMovement.Query().Where(providermovement.Reference(reference)).Only(ctx)
	if err != nil {
		return err
	}
	if movement.Status != providermovement.StatusPending || movement.BlockedOn != "" || (movement.NotBefore != nil && movement.NotBefore.After(gateway.Container.Now())) {
		return nil
	}
	provider, err := gateway.Container.Wallets(movement.Provider)
	if err != nil {
		return err
	}
	if movement.FromWalletRef != "" {
		if refusal := gateway.precheckWalletDebit(ctx, provider, movement); refusal != "" {
			return gateway.applyMovementOutcome(ctx, reference, interfaces.OutcomeFailed, refusal, "")
		}
	} else if short := gateway.mainBalanceShortFor(ctx, movement); short {
		later := gateway.Container.Now().UTC().Add(15 * time.Minute)
		gateway.RecordPaymentAlertMetric(ctx, "mainBalanceTooLowForMovement", "reference", movement.Reference, "amountMinor", movement.AmountMinor)
		return gateway.Container.Client(gateway.Container.Resources.Database).ProviderMovement.UpdateOneID(movement.ID).SetNotBefore(later).
			SetFailureReason("waiting for the main balance to cover this movement").Exec(ctx)
	}
	claimed, err := gateway.Container.Client(gateway.Container.Resources.Database).ProviderMovement.Update().
		Where(providermovement.ID(movement.ID), providermovement.StatusEQ(providermovement.StatusPending), providermovement.Version(movement.Version)).
		SetStatus(providermovement.StatusProcessing).SetSentAt(gateway.Container.Now().UTC()).AddAttempts(1).AddVersion(1).Save(ctx)
	if err != nil || claimed == 0 {
		return err
	}
	return gateway.sendClaimedMovement(ctx, provider, movement)
}

func (gateway *PaymentGateway) sendClaimedMovement(ctx context.Context, provider interfaces.WalletProvider, movement *ent.ProviderMovement) error {
	result, err := provider.MoveBetweenWallets(ctx, interfaces.WalletMove{
		FromAccountRef: movement.FromWalletRef, FromPlatformBalance: movement.FromWalletRef == "", ToBarterId: movement.ToBarterID, ToPlatformBalance: movement.ToPlatform,
		AmountMinor: movement.AmountMinor, Currency: movement.Currency, Reference: movement.Reference, Narration: "Zudomart " + movement.Kind,
	})
	switch {
	case errors.Is(err, providerhttp.ErrOutcomeUnknown):
		return nil
	case err != nil && isDefinitiveProviderRejection(err):
		return gateway.ConfirmMovement(ctx, movement.Reference, truncateReason(providerhttp.RedactSecrets(err.Error())))
	case err != nil:
		return nil
	}
	if result.ProviderTransferId != "" {
		_ = gateway.Container.Client(gateway.Container.Resources.Database).ProviderMovement.UpdateOneID(movement.ID).SetProviderTransferID(result.ProviderTransferId).Exec(ctx)
	}
	return gateway.ConfirmMovement(ctx, movement.Reference, "")
}

func (gateway *PaymentGateway) precheckWalletDebit(ctx context.Context, provider interfaces.WalletProvider, movement *ent.ProviderMovement) string {
	balance, err := provider.ReadWalletBalance(ctx, movement.FromWalletRef, movement.Currency)
	if err != nil && isDefinitiveProviderRejection(err) {
		gateway.FreezeProviderWallet(ctx, movement.FromUserID, "the provider no longer recognises this wallet")
		gateway.OpenReconciliationCase(ctx, "walletMissingAtProvider", movement.FromWalletRef, movement.FromWalletRef, 0, 0, movement.Currency, "a movement found the wallet deleted at the provider")
		return "the source wallet no longer exists at the provider"
	}
	if err == nil && balance.AvailableMinor < movement.AmountMinor {
		gateway.FreezeProviderWallet(ctx, movement.FromUserID, "the provider balance is below the ledger")
		gateway.OpenReconciliationCase(ctx, "walletBelowLedgerOnDebit", movement.FromWalletRef, movement.Reference, movement.AmountMinor, balance.AvailableMinor, movement.Currency, "a debit found less money in the wallet than the ledger expects")
		return "the source wallet holds less than this movement"
	}
	return ""
}

func (gateway *PaymentGateway) mainBalanceShortFor(ctx context.Context, movement *ent.ProviderMovement) bool {
	payouts, err := gateway.Container.Payouts(movement.Provider)
	if err != nil {
		return false
	}
	balances, err := payouts.ReadPlatformBalances(ctx)
	if err != nil {
		return false
	}
	for _, balance := range balances {
		if balance.Currency == movement.Currency {
			return balance.AvailableMinor < movement.AmountMinor
		}
	}
	return true
}

func (gateway *PaymentGateway) ConfirmMovement(ctx context.Context, reference, rejection string) error {
	movement, err := gateway.Container.Client(gateway.Container.Resources.Database).ProviderMovement.Query().Where(providermovement.Reference(reference)).Only(ctx)
	if err != nil || movement.Status != providermovement.StatusProcessing {
		return err
	}
	provider, err := gateway.Container.Payouts(movement.Provider)
	if err != nil {
		return err
	}
	confirmed, err := provider.VerifyTransfer(ctx, reference)
	switch {
	case err != nil && isDefinitiveProviderRejection(err) && rejection != "":
		return gateway.applyMovementOutcome(ctx, reference, interfaces.OutcomeFailed, rejection, "")
	case err != nil && isDefinitiveProviderRejection(err):
		return gateway.resendLostMovement(ctx, movement)
	case err != nil:
		return convertProviderError(err)
	case confirmed.Outcome == interfaces.OutcomePending:
		return nil
	}
	return gateway.applyMovementOutcome(ctx, reference, confirmed.Outcome, confirmed.FailureReason, confirmed.ProviderTransferId)
}

func (gateway *PaymentGateway) resendLostMovement(ctx context.Context, movement *ent.ProviderMovement) error {
	if movement.SentAt != nil && gateway.Container.Now().Sub(*movement.SentAt) < movementResendAfter {
		return nil
	}
	provider, err := gateway.Container.Wallets(movement.Provider)
	if err != nil {
		return err
	}
	claimed, err := gateway.Container.Client(gateway.Container.Resources.Database).ProviderMovement.Update().
		Where(providermovement.ID(movement.ID), providermovement.Version(movement.Version), providermovement.StatusEQ(providermovement.StatusProcessing)).
		SetSentAt(gateway.Container.Now().UTC()).AddAttempts(1).AddVersion(1).Save(ctx)
	if err != nil || claimed == 0 {
		return err
	}
	gateway.Container.Resources.Logger.WarnContext(ctx, "the provider has no record of a sent movement; sending it again under the same reference", "reference", movement.Reference)
	return gateway.sendClaimedMovement(ctx, provider, movement)
}

func ConvertMovementToFinished(movement *ent.ProviderMovement, failureReason string) models.FinishedMovement {
	metadata := map[string]any{}
	decoder := json.NewDecoder(strings.NewReader(string(movement.Metadata)))
	decoder.UseNumber()
	_ = decoder.Decode(&metadata)
	finished := models.FinishedMovement{
		MovementId: movement.ID, Reference: movement.Reference, Kind: movement.Kind, SubjectId: movement.SubjectID, UserId: movement.UserID,
		FromWalletRef: movement.FromWalletRef, FromUserId: movement.FromUserID, ToWalletRef: movement.ToWalletRef, ToUserId: movement.ToUserID,
		ToPlatform: movement.ToPlatform, AmountMinor: movement.AmountMinor, Currency: movement.Currency, FailureReason: failureReason, Metadata: metadata,
	}
	if movement.FinishedAt != nil {
		finished.FinishedAt = *movement.FinishedAt
	}
	return finished
}
