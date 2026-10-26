package services

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	ledgerutils "nantty/modules/ledger/src/utils"
	paymentconstants "nantty/modules/payments/src/constants"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
	paymentservices "nantty/modules/payments/src/modules/gateway/services"
	"nantty/modules/subscriptions/src/generated/ent"
	"nantty/modules/subscriptions/src/generated/ent/creatorsubscription"
	"nantty/modules/subscriptions/src/generated/ent/creatorsubscriptioncharge"
	"nantty/modules/subscriptions/src/models"
)

type StartCreatorSubscription struct {
	SubscriberId   string
	CreatorId      string
	PlanId         string
	ReturnTo       string
	ClientPlatform string
	IdempotencyKey string
}

type startedCreatorSubscription struct {
	SubscriptionId string `json:"subscriptionId"`
	IntentId       string `json:"intentId"`
	Reference      string `json:"reference"`
}

func (service CreatorSubscriptions) StartSubscription(ctx context.Context, request StartCreatorSubscription) (CreatorCheckoutView, bool, error) {
	if request.ClientPlatform == "ios" || request.ClientPlatform == "android" {
		return CreatorCheckoutView{}, false, paymentservices.ErrWebBillingOnly
	}
	plan, err := service.loadSubscribablePlan(ctx, request.SubscriberId, request.CreatorId, request.PlanId)
	if err != nil {
		return CreatorCheckoutView{}, false, err
	}
	started, replayed, err := ledgerutils.RunIdempotentMoneyCommand(ctx, service.Container.Resources.Database, service.Container.Idempotency, ledgerutils.IdempotentCommand[startedCreatorSubscription]{
		Scope: "user:" + request.SubscriberId + ":creatorSubscriptions.start", Key: request.IdempotencyKey,
		RequestHash: ledgerutils.HashRequestFingerprint(plan.CreatorID, plan.ID.String(), request.ReturnTo),
		Execute: func(ctx context.Context, transaction *sql.Tx) (startedCreatorSubscription, error) {
			return service.createPendingSubscriptionInTransaction(ctx, transaction, request.SubscriberId, plan, request.ReturnTo)
		},
	})
	if err != nil {
		return CreatorCheckoutView{}, false, err
	}
	intentId, _ := uuid.Parse(started.IntentId)
	opened, err := service.Container.Payments.OpenProviderCheckoutForIntent(ctx, intentId)
	if err != nil {
		service.markStartFailed(ctx, started.SubscriptionId, err)
		return CreatorCheckoutView{}, false, err
	}
	row, err := service.Container.Client(service.Container.Resources.Database).CreatorSubscription.Get(ctx, uuid.MustParse(started.SubscriptionId))
	if err != nil {
		return CreatorCheckoutView{}, false, err
	}
	view := CreatorCheckoutView{SubscriptionId: started.SubscriptionId, Reference: opened.Reference, Subscription: ConvertCreatorSubscription(row)}
	if opened.CheckoutUrl != nil {
		view.CheckoutUrl, view.AuthorizationUrl = *opened.CheckoutUrl, *opened.CheckoutUrl
	}
	return view, replayed, nil
}

func (service CreatorSubscriptions) loadSubscribablePlan(ctx context.Context, subscriberId, creatorId, planId string) (*ent.CreatorSubscriptionPlan, error) {
	creator, found, err := service.Container.Creators.FindCreator(ctx, creatorId)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, ErrCreatorPlanNotFound
	}
	if creator.AccountId == subscriberId {
		return nil, ErrCannotSubscribeToSelf
	}
	if !creator.Approved {
		return nil, ErrCreatorNotApproved
	}
	id, err := uuid.Parse(planId)
	if err != nil {
		return nil, ErrCreatorPlanNotFound
	}
	plan, err := service.Container.Client(service.Container.Resources.Database).CreatorSubscriptionPlan.Get(ctx, id)
	if ent.IsNotFound(err) || (err == nil && (plan.CreatorID != creator.AccountId || !plan.Active)) {
		return nil, ErrCreatorPlanNotFound
	}
	if err != nil {
		return nil, err
	}
	if blocked, err := service.Container.Creators.BlockedEitherWay(ctx, subscriberId, creator.AccountId); err != nil || blocked {
		if err == nil {
			err = ErrSubscriptionBlocked
		}
		return nil, err
	}
	return plan, nil
}

func (service CreatorSubscriptions) clearWayForNewSubscriptionInTransaction(ctx context.Context, client *ent.Client, subscriberId, creatorId string) error {
	if _, err := client.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", "creator-subscription:"+subscriberId+":"+creatorId); err != nil {
		return err
	}
	now := service.Container.Now().UTC()
	existing, err := client.CreatorSubscription.Query().Where(creatorsubscription.SubscriberID(subscriberId), creatorsubscription.CreatorID(creatorId),
		creatorsubscription.StatusIn(append(accessStatuses(), creatorsubscription.StatusPending)...)).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range existing {
		switch {
		case row.Status == creatorsubscription.StatusPending:
			if err := row.Update().SetStatus(creatorsubscription.StatusFailed).SetLastError("supersededByNewAttempt").Exec(ctx); err != nil {
				return err
			}
		case models.HasCreatorSubscriberAccess(row.Status.String(), row.CurrentPeriodEnd, now) && row.Status == creatorsubscription.StatusCancelled:
			return ErrResumeInstead
		case models.HasCreatorSubscriberAccess(row.Status.String(), row.CurrentPeriodEnd, now):
			return ErrAlreadySubscribedCreator
		}
	}
	return nil
}

func (service CreatorSubscriptions) createPendingSubscriptionInTransaction(ctx context.Context, transaction *sql.Tx, subscriberId string, plan *ent.CreatorSubscriptionPlan, returnTo string) (startedCreatorSubscription, error) {
	client := service.Container.Client(transaction)
	if err := service.clearWayForNewSubscriptionInTransaction(ctx, client, subscriberId, plan.CreatorID); err != nil {
		return startedCreatorSubscription{}, err
	}
	now := service.Container.Now().UTC()
	subscription, err := client.CreatorSubscription.Create().SetID(uuid.Must(uuid.NewV7())).SetSubscriberID(subscriberId).SetCreatorID(plan.CreatorID).SetPlanID(plan.ID.String()).
		SetAmountMinor(plan.AmountMinor).SetCurrency(plan.Currency).SetInterval(creatorsubscription.Interval(plan.Interval.String())).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return startedCreatorSubscription{}, err
	}
	charge, err := client.CreatorSubscriptionCharge.Create().SetID(uuid.Must(uuid.NewV7())).SetSubscriptionID(subscription.ID.String()).SetSubscriberID(subscriberId).
		SetCreatorID(plan.CreatorID).SetKind(creatorsubscriptioncharge.KindInitial).SetIdempotencyKey("initial:" + subscription.ID.String()).SetAttemptCount(1).
		SetAmountMinor(plan.AmountMinor).SetCurrency(plan.Currency).SetCreatedAt(now).Save(ctx)
	if err != nil {
		return startedCreatorSubscription{}, err
	}
	intent, err := service.Container.Payments.CreatePendingPaymentIntentInTransaction(ctx, transaction, paymentmodels.CreatePaymentIntentRequest{
		Purpose: paymentconstants.PurposeCreatorSubscription, OwnerUserId: subscriberId, SubjectId: charge.ID.String(), AmountMinor: plan.AmountMinor, Currency: plan.Currency, ReturnTo: returnTo,
		Metadata: map[string]string{"creatorSubscriptionId": subscription.ID.String(), "creatorId": plan.CreatorID, "planId": plan.ID.String()},
	})
	if err != nil {
		return startedCreatorSubscription{}, err
	}
	if err := charge.Update().SetPaymentReference(intent.Reference).Exec(ctx); err != nil {
		return startedCreatorSubscription{}, err
	}
	return startedCreatorSubscription{SubscriptionId: subscription.ID.String(), IntentId: intent.Id.String(), Reference: intent.Reference}, nil
}

func (service CreatorSubscriptions) markStartFailed(ctx context.Context, subscriptionId string, cause error) {
	id, err := uuid.Parse(subscriptionId)
	if err != nil {
		return
	}
	_ = service.Container.Client(service.Container.Resources.Database).CreatorSubscription.Update().
		Where(creatorsubscription.ID(id), creatorsubscription.StatusEQ(creatorsubscription.StatusPending)).
		SetStatus(creatorsubscription.StatusFailed).SetLastError(truncateText(cause.Error(), 300)).Exec(ctx)
}

func (service CreatorSubscriptions) VerifyPayment(ctx context.Context, subscriberId, reference string) (CreatorSubscriptionStateView, error) {
	client := service.Container.Client(service.Container.Resources.Database)
	charge, err := client.CreatorSubscriptionCharge.Query().Where(creatorsubscriptioncharge.PaymentReference(reference), creatorsubscriptioncharge.SubscriberID(subscriberId)).Only(ctx)
	if ent.IsNotFound(err) {
		return CreatorSubscriptionStateView{}, ErrCreatorSubscriptionGone
	}
	if err != nil {
		return CreatorSubscriptionStateView{}, err
	}
	if charge.Status == creatorsubscriptioncharge.StatusPending {
		if _, err := service.Container.Payments.VerifyAndSettlePaymentIntentByReference(ctx, reference); err != nil {
			return CreatorSubscriptionStateView{}, err
		}
	}
	row, err := client.CreatorSubscription.Get(ctx, uuid.MustParse(charge.SubscriptionID))
	if err != nil {
		return CreatorSubscriptionStateView{}, err
	}
	return ConvertCreatorSubscription(row), nil
}

func truncateText(value string, maximum int) string {
	if len(value) > maximum {
		return value[:maximum]
	}
	return value
}
