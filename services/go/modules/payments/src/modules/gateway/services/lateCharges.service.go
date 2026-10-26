package services

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"nantty/modules/ledger/src/databases"
	"nantty/modules/payments/src/generated/ent"
	"nantty/modules/payments/src/generated/ent/paymentintent"
	"nantty/modules/payments/src/interfaces"
	"nantty/modules/payments/src/modules/gateway/models"
)

const oneSettlementPerSubjectIndex = "payment_intents_one_settlement_per_subject"

func isSecondSettlementOfSubject(err error) bool {
	var postgresError *pgconn.PgError
	return errors.As(err, &postgresError) && postgresError.Code == "23505" && postgresError.ConstraintName == oneSettlementPerSubjectIndex
}

func lateChargeReference(intentReference, chargeId string) string {
	digest := sha256.Sum256([]byte(chargeId))
	return intentReference + "-late-" + hex.EncodeToString(digest[:6])
}

func (gateway *PaymentGateway) refundLateChargeOnClosedIntent(ctx context.Context, intent *ent.PaymentIntent, chargeId string) (models.PaymentIntentView, error) {
	unchanged := ConvertPaymentIntentToView(intent)
	if chargeId == "" || chargeId == intent.ProviderTransactionID || (intent.Status != paymentintent.StatusSucceeded && intent.Status != paymentintent.StatusFailed) {
		return unchanged, nil
	}
	provider, err := gateway.Container.Provider(intent.Provider)
	if err != nil {
		return unchanged, err
	}
	verification, err := provider.VerifyCharge(ctx, interfaces.ChargeLookup{Reference: intent.Reference, ProviderChargeId: chargeId})
	if err != nil {
		return unchanged, convertProviderError(err)
	}
	if verification.Outcome != interfaces.OutcomeSucceeded || verification.ProviderChargeId != chargeId || verification.AmountMinor <= 0 {
		return unchanged, nil
	}
	verification.Reference = intent.Reference
	var refund *RequestedRefund
	err = databases.RunInMoneyTransaction(ctx, gateway.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		refund, err = gateway.recordLateChargeInTransaction(ctx, transaction, intent.ID, verification)
		return err
	})
	if err != nil {
		return unchanged, err
	}
	if refund != nil && !refund.Replayed {
		_ = gateway.SendPendingRefundToProvider(ctx, refund.RefundId)
	}
	return unchanged, nil
}

func (gateway *PaymentGateway) recordLateChargeInTransaction(ctx context.Context, transaction *sql.Tx, intentId uuid.UUID, verification interfaces.ChargeVerification) (*RequestedRefund, error) {
	client := gateway.Container.Client(transaction)
	subject, err := client.PaymentIntent.Get(ctx, intentId)
	if err != nil {
		return nil, err
	}
	if err := lockPaymentSubject(ctx, transaction, string(subject.Purpose), subject.SubjectID); err != nil {
		return nil, err
	}
	intent, err := client.PaymentIntent.Query().Where(paymentintent.ID(intentId)).ForUpdate().Only(ctx)
	if err != nil {
		return nil, err
	}
	if isSettleable(intent.Status) || intent.ProviderTransactionID == verification.ProviderChargeId || verification.AmountMinor <= 0 {
		return nil, nil
	}
	recorded, err := client.PaymentIntent.Query().Where(paymentintent.Provider(intent.Provider), paymentintent.ProviderTransactionID(verification.ProviderChargeId)).Exist(ctx)
	if err != nil || recorded {
		return nil, err
	}
	now := gateway.Container.Now().UTC()
	metadata, _ := json.Marshal(map[string]string{"lateChargeOf": intent.Reference, "lateChargeOfStatus": string(intent.Status)})
	duplicate, err := client.PaymentIntent.Create().
		SetReference(lateChargeReference(intent.Reference, verification.ProviderChargeId)).SetPurpose(intent.Purpose).SetOwnerUserID(intent.OwnerUserID).
		SetSubjectID(intent.SubjectID).SetProvider(intent.Provider).SetAmountMinor(verification.AmountMinor).SetCurrency(verification.Currency).
		SetConnectedAccountID(intent.ConnectedAccountID).SetBeneficiaryUserID(intent.BeneficiaryUserID).
		SetStatus(paymentintent.StatusSucceeded).SetPaidAt(now).SetProviderSettledAt(now).SetProviderTransactionID(verification.ProviderChargeId).
		SetProviderFeeMinor(max(verification.ProviderFeeMinor, 0)).SetFailureReason(duplicatePaymentReason).SetCustomerEmail(verification.CustomerEmail).
		SetMetadata(metadata).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return nil, fmt.Errorf("record late charge on %s: %w", intent.Reference, err)
	}
	if err := gateway.postCollectionJournalEntries(ctx, transaction, duplicate); err != nil {
		return nil, err
	}
	refund, err := gateway.refundDuplicatePaymentInTransaction(ctx, transaction, duplicate)
	return &refund, err
}

func (gateway *PaymentGateway) alertFinanceOfDuplicateSettlement(ctx context.Context, transaction *sql.Tx, duplicate *ent.PaymentIntent) error {
	_, err := gateway.openReconciliationCaseInTransaction(ctx, transaction, "duplicateSettlement", string(duplicate.Purpose)+":"+duplicate.SubjectID, duplicate.Reference,
		0, duplicate.AmountMinor, duplicate.Currency, fmt.Sprintf("a second payment for %s %s was refunded automatically (charge %s)", duplicate.Purpose, duplicate.SubjectID, duplicate.ProviderTransactionID))
	return err
}

func (gateway *PaymentGateway) refuseWalletWhenTheCheckoutWasAlreadyPaid(ctx context.Context, request models.WalletPaymentRequest) error {
	intent, err := gateway.Container.Client(gateway.Container.Resources.Database).PaymentIntent.Query().
		Where(paymentintent.Reference(request.Reference), paymentintent.OwnerUserID(request.UserId)).Only(ctx)
	if err != nil || intent.Status != paymentintent.StatusPending || (intent.AuthorizationURL == "" && intent.ProviderCheckoutID == "") {
		return nil
	}
	provider, err := gateway.Container.Provider(intent.Provider)
	if err != nil {
		return nil
	}
	verification, err := provider.VerifyCharge(ctx, interfaces.ChargeLookup{Reference: intent.Reference})
	if err != nil || verification.Outcome != interfaces.OutcomeSucceeded {
		return nil
	}
	if _, err := gateway.verifyAndSettlePaymentIntent(ctx, intent.Reference, verification.ProviderChargeId); err != nil {
		gateway.Container.Resources.Logger.WarnContext(ctx, "the card payment found before a wallet payment could not be applied yet", "reference", intent.Reference, "error", err)
	}
	return ErrAlreadyPaid
}
