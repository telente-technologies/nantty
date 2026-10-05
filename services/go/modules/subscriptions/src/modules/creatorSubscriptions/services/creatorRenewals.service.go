package services

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	paymentservices "zudomart/modules/payments/src/modules/gateway/services"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/creatorsubscription"
	"zudomart/modules/subscriptions/src/generated/ent/creatorsubscriptioncharge"
	"zudomart/modules/subscriptions/src/models"
)

const creatorRenewalLease = 15 * time.Minute

func (service CreatorSubscriptions) RunDueRenewals(ctx context.Context, limit int) int {
	service.expireEndedSubscriptions(ctx, limit)
	now := service.Container.Now().UTC()
	client := service.Container.Client(service.Container.Resources.Database)
	due, err := client.CreatorSubscription.Query().Where(creatorsubscription.NextChargeAtLTE(now),
		creatorsubscription.StatusIn(creatorsubscription.StatusActive, creatorsubscription.StatusPastDue)).Limit(limit).IDs(ctx)
	if err != nil {
		return 0
	}
	processed := 0
	for _, id := range due {
		claimed, err := client.CreatorSubscription.Update().Where(creatorsubscription.ID(id), creatorsubscription.NextChargeAtLTE(now)).SetNextChargeAt(now.Add(creatorRenewalLease)).Save(ctx)
		if err != nil || claimed == 0 {
			continue
		}
		if err := service.renewSubscription(ctx, id); err != nil {
			service.Container.Resources.Logger.ErrorContext(ctx, "creator subscription renewal failed", "subscriptionId", id.String(), "error", err.Error())
			continue
		}
		processed++
	}
	return processed
}

func (service CreatorSubscriptions) expireEndedSubscriptions(ctx context.Context, limit int) {
	now := service.Container.Now().UTC()
	client := service.Container.Client(service.Container.Resources.Database)
	ended, err := client.CreatorSubscription.Query().Where(creatorsubscription.Or(
		creatorsubscription.And(creatorsubscription.StatusEQ(creatorsubscription.StatusCancelled), creatorsubscription.CurrentPeriodEndLTE(now)),
		creatorsubscription.And(creatorsubscription.StatusEQ(creatorsubscription.StatusPastDue), creatorsubscription.CurrentPeriodEndLTE(now.Add(-models.CreatorRenewalGracePeriod))),
	)).Limit(limit).All(ctx)
	if err != nil {
		return
	}
	for _, row := range ended {
		_ = databases.RunInMoneyTransaction(ctx, service.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
			count, err := service.Container.Client(transaction).CreatorSubscription.Update().Where(creatorsubscription.ID(row.ID), creatorsubscription.StatusEQ(row.Status)).
				SetStatus(creatorsubscription.StatusExpired).ClearNextChargeAt().Save(ctx)
			if err != nil || count == 0 {
				return err
			}
			data := lifecycleEventData(row)
			data["status"], data["reason"] = "expired", map[bool]string{true: "cancelled", false: "renewal_failed"}[row.Status == creatorsubscription.StatusCancelled]
			return service.emit(ctx, transaction, "creatorSubscription.expired", row.ID.String(), data)
		})
	}
}

func (service CreatorSubscriptions) ensureRenewalCharge(ctx context.Context, row *ent.CreatorSubscription) (*ent.CreatorSubscriptionCharge, error) {
	client := service.Container.Client(service.Container.Resources.Database)
	key := models.RenewalIdempotencyKey("creator:"+row.ID.String(), *row.CurrentPeriodEnd)
	err := client.CreatorSubscriptionCharge.Create().SetID(uuid.Must(uuid.NewV7())).SetSubscriptionID(row.ID.String()).SetSubscriberID(row.SubscriberID).SetCreatorID(row.CreatorID).
		SetKind(creatorsubscriptioncharge.KindRenewal).SetIdempotencyKey(key).SetAmountMinor(row.AmountMinor).SetCurrency(row.Currency).SetPeriodStart(*row.CurrentPeriodEnd).
		SetCreatedAt(service.Container.Now().UTC()).OnConflictColumns(creatorsubscriptioncharge.FieldIdempotencyKey).DoNothing().Exec(ctx)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	return client.CreatorSubscriptionCharge.Query().Where(creatorsubscriptioncharge.IdempotencyKey(key)).Only(ctx)
}

func (service CreatorSubscriptions) renewSubscription(ctx context.Context, id uuid.UUID) error {
	client := service.Container.Client(service.Container.Resources.Database)
	row, err := client.CreatorSubscription.Get(ctx, id)
	if err != nil || row.CurrentPeriodEnd == nil {
		return err
	}
	charge, err := service.ensureRenewalCharge(ctx, row)
	if err != nil || charge.Status == creatorsubscriptioncharge.StatusSucceeded {
		return err
	}
	if row.BillingAuthorizationID == "" {
		return service.recordRenewalFailure(ctx, charge.ID, "No saved card to renew this subscription.")
	}
	reference := charge.PaymentReference
	if reference != "" {
		previous, err := service.Container.Payments.ConfirmPreviousBillingCharge(ctx, reference)
		if err != nil {
			return err
		}
		switch previous {
		case paymentservices.BillingChargeSucceeded:
			return nil
		case paymentservices.BillingChargePending, paymentservices.BillingChargeRequiresAction:
			return client.CreatorSubscription.UpdateOneID(row.ID).SetNextChargeAt(service.Container.Now().UTC().Add(creatorRenewalLease)).Exec(ctx)
		case paymentservices.BillingChargeFailed:
			reference = ""
		}
	}
	if reference == "" {
		attempt := charge.AttemptCount + 1
		reference = models.RenewalChargeReference(charge.IdempotencyKey, attempt)
		if err := charge.Update().SetAttemptCount(attempt).SetPaymentReference(reference).SetStatus(creatorsubscriptioncharge.StatusPending).Exec(ctx); err != nil {
			return err
		}
	}
	result, err := service.Container.Payments.ChargeBillingAuthorization(ctx, paymentservices.BillingAuthorizationCharge{
		OwnerUserId: row.SubscriberID, AuthorizationId: row.BillingAuthorizationID, SubjectId: charge.ID.String(), Reference: reference,
		AmountMinor: charge.AmountMinor, Currency: charge.Currency, Metadata: map[string]string{"creatorSubscriptionId": row.ID.String(), "chargeId": charge.ID.String()},
	})
	if errors.Is(err, paymentservices.ErrBillingAuthorizationMissing) || errors.Is(err, paymentservices.ErrVerifyEmailRequired) {
		return service.recordRenewalFailure(ctx, charge.ID, "We couldn't use the saved card.")
	}
	if err != nil {
		return err
	}
	switch result.Status {
	case paymentservices.BillingChargeFailed, paymentservices.BillingChargeRequiresAction:
		if result.Settled {
			return nil
		}
		return service.recordRenewalFailure(ctx, charge.ID, firstText(result.FailureReason, "The payment was declined."))
	case paymentservices.BillingChargePending:
		return client.CreatorSubscription.UpdateOneID(row.ID).SetNextChargeAt(service.Container.Now().UTC().Add(time.Hour)).Exec(ctx)
	}
	return nil
}

func (service CreatorSubscriptions) recordRenewalFailure(ctx context.Context, chargeId uuid.UUID, reason string) error {
	return databases.RunInMoneyTransaction(ctx, service.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		charge, row, err := service.lockCharge(ctx, transaction, chargeId.String())
		if err != nil || charge == nil || charge.Status == creatorsubscriptioncharge.StatusSucceeded {
			return err
		}
		if err := charge.Update().SetStatus(creatorsubscriptioncharge.StatusFailed).SetFailureReason(truncateText(reason, 300)).Exec(ctx); err != nil {
			return err
		}
		return service.recordFailureInTransaction(ctx, transaction, row, charge, reason)
	})
}
