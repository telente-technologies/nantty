package services

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/subscriptions/src/generated/ent"
	"zudomart/modules/subscriptions/src/generated/ent/creatorsubscription"
	"zudomart/modules/subscriptions/src/generated/ent/creatorsubscriptionplan"
	"zudomart/modules/subscriptions/src/models"
	"zudomart/modules/subscriptions/src/repositories"
	"zudomart/platform/regionpricing"
)

type NewCreatorPlan struct {
	CreatorId   string
	Name        string
	Description string
	AmountMinor int64
	Currency    string
	Interval    string
	Benefits    []models.CreatorPlanBenefit
}

type CreatorPlanChange struct {
	Name        *string
	Description *string
	Benefits    *[]models.CreatorPlanBenefit
	Active      *bool
}

func (service CreatorSubscriptions) requireApprovedCreator(ctx context.Context, userId string) (string, error) {
	creator, found, err := service.Container.Creators.FindCreator(ctx, userId)
	if err != nil {
		return "", err
	}
	if !found || !creator.Approved {
		return "", ErrCreatorProgramRequired
	}
	return creator.AccountId, nil
}

func (service CreatorSubscriptions) creatorBandsFor(ctx context.Context, currency string) ([]regionpricing.CreatorSubscriptionBand, error) {
	region, known := regionpricing.RegionForCurrency(strings.ToUpper(currency))
	if !known {
		return nil, ErrCurrencyNotPriced
	}
	raw, found := service.Container.Resources.Platform.ReadValue(ctx, regionpricing.SettingKey)
	return regionpricing.ParseSettingDocument(raw, found).CreatorSubscriptionBands[region.Code], nil
}

func (service CreatorSubscriptions) CreatePlan(ctx context.Context, plan NewCreatorPlan) (CreatorPlanView, error) {
	creatorId, err := service.requireApprovedCreator(ctx, plan.CreatorId)
	if err != nil {
		return CreatorPlanView{}, err
	}
	plan.Currency = strings.ToUpper(plan.Currency)
	bands, err := service.creatorBandsFor(ctx, plan.Currency)
	if err != nil {
		return CreatorPlanView{}, err
	}
	if _, err := models.CheckCreatorPlanPrice(plan.AmountMinor, plan.Interval, bands); err != nil {
		if errors.Is(err, models.ErrCreatorPriceNoBands) {
			return CreatorPlanView{}, ErrCurrencyNotPriced
		}
		return CreatorPlanView{}, ErrPriceOutsideBands
	}
	if _, isTier := regionpricing.FindCreatorTier(plan.AmountMinor, plan.Currency, plan.Interval); !isTier {
		return CreatorPlanView{}, ErrPriceNotATier
	}
	var created *ent.CreatorSubscriptionPlan
	err = databases.RunInMoneyTransaction(ctx, service.Container.Resources.Database, func(ctx context.Context, transaction *sql.Tx) error {
		var err error
		created, err = service.Container.Client(transaction).CreatorSubscriptionPlan.Create().SetID(uuid.Must(uuid.NewV7())).SetCreatorID(creatorId).SetName(plan.Name).
			SetDescription(plan.Description).SetAmountMinor(plan.AmountMinor).SetCurrency(plan.Currency).SetInterval(creatorsubscriptionplan.Interval(plan.Interval)).
			SetBenefits(plan.Benefits).SetCreatedAt(service.Container.Now().UTC()).Save(ctx)
		if err != nil {
			return err
		}
		return service.emit(ctx, transaction, "creatorSubscriptionPlan.created", created.ID.String(), map[string]any{
			"planId": created.ID.String(), "creatorId": creatorId, "price": MoneyView{created.AmountMinor, created.Currency}, "interval": plan.Interval,
		})
	})
	if err != nil {
		return CreatorPlanView{}, err
	}
	return ConvertCreatorPlan(created, 0), nil
}

func (service CreatorSubscriptions) UpdatePlan(ctx context.Context, userId, planId string, change CreatorPlanChange) (CreatorPlanView, error) {
	id, err := uuid.Parse(planId)
	if err != nil {
		return CreatorPlanView{}, ErrCreatorPlanNotFound
	}
	client := service.Container.Client(service.Container.Resources.Database)
	plan, err := client.CreatorSubscriptionPlan.Get(ctx, id)
	if ent.IsNotFound(err) || (err == nil && plan.CreatorID != userId) {
		return CreatorPlanView{}, ErrCreatorPlanNotFound
	}
	if err != nil {
		return CreatorPlanView{}, err
	}
	update := plan.Update()
	if change.Name != nil {
		update.SetName(*change.Name)
	}
	if change.Description != nil {
		update.SetDescription(*change.Description)
	}
	if change.Benefits != nil {
		update.SetBenefits(*change.Benefits)
	}
	if change.Active != nil {
		update.SetActive(*change.Active)
	}
	if plan, err = update.Save(ctx); err != nil {
		return CreatorPlanView{}, err
	}
	counts, err := service.subscriberCountsByPlan(ctx, userId)
	return ConvertCreatorPlan(plan, counts[plan.ID.String()]), err
}

func (service CreatorSubscriptions) ListPlans(ctx context.Context, creatorId string, includeInactive bool) ([]CreatorPlanView, error) {
	if creator, found, err := service.Container.Creators.FindCreator(ctx, creatorId); err != nil {
		return nil, err
	} else if found {
		creatorId = creator.AccountId
	}
	query := service.Container.Client(service.Container.Resources.Database).CreatorSubscriptionPlan.Query().Where(creatorsubscriptionplan.CreatorID(creatorId))
	if !includeInactive {
		query.Where(creatorsubscriptionplan.Active(true))
	}
	plans, err := query.Order(ent.Asc(creatorsubscriptionplan.FieldAmountMinor), ent.Asc(creatorsubscriptionplan.FieldCreatedAt)).Limit(100).All(ctx)
	if err != nil {
		return nil, err
	}
	counts, err := service.subscriberCountsByPlan(ctx, creatorId)
	if err != nil {
		return nil, err
	}
	views := make([]CreatorPlanView, 0, len(plans))
	for _, plan := range plans {
		views = append(views, ConvertCreatorPlan(plan, counts[plan.ID.String()]))
	}
	return views, nil
}

func (service CreatorSubscriptions) currentSubscribers(ctx context.Context, creatorId string) ([]*ent.CreatorSubscription, error) {
	now := service.Container.Now().UTC()
	return service.Container.Client(service.Container.Resources.Database).CreatorSubscription.Query().
		Where(creatorsubscription.CreatorID(creatorId), creatorsubscription.StatusIn(accessStatuses()...), creatorsubscription.CurrentPeriodEndGT(now)).
		Order(ent.Desc(creatorsubscription.FieldCreatedAt)).Limit(500).All(ctx)
}

func (service CreatorSubscriptions) subscriberCountsByPlan(ctx context.Context, creatorId string) (map[string]int, error) {
	rows, err := service.currentSubscribers(ctx, creatorId)
	counts := map[string]int{}
	for _, row := range rows {
		counts[row.PlanID]++
	}
	return counts, err
}

func (service CreatorSubscriptions) ListSubscribers(ctx context.Context, creatorId string) ([]CreatorSubscriberView, error) {
	rows, err := service.currentSubscribers(ctx, creatorId)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.SubscriberID)
	}
	users, err := service.Container.Creators.FindUserSummaries(ctx, ids)
	if err != nil {
		return nil, err
	}
	plans, err := service.Container.Client(service.Container.Resources.Database).CreatorSubscriptionPlan.Query().Where(creatorsubscriptionplan.CreatorID(creatorId)).All(ctx)
	if err != nil {
		return nil, err
	}
	names := map[string]string{}
	for _, plan := range plans {
		names[plan.ID.String()] = plan.Name
	}
	views := make([]CreatorSubscriberView, 0, len(rows))
	for _, row := range rows {
		var user *repositories.UserSummary
		if summary, found := users[row.SubscriberID]; found {
			user = &summary
		}
		views = append(views, ConvertCreatorSubscriber(row, user, names[row.PlanID]))
	}
	return views, nil
}

func accessStatuses() []creatorsubscription.Status {
	return []creatorsubscription.Status{creatorsubscription.StatusActive, creatorsubscription.StatusPastDue, creatorsubscription.StatusCancelled}
}

func (service CreatorSubscriptions) emit(ctx context.Context, transaction *sql.Tx, eventType, subject string, data map[string]any) error {
	return service.Container.Outbox.EnqueueInTransaction(ctx, transaction, eventType, subject, service.Container.Now().UTC(), data)
}
