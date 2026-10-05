package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	ordererrors "zudomart/modules/orders/src/errors"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/customersegment"
	"zudomart/platform/commerceports"
	"zudomart/platform/sellerplans"
)

func LoadSegmentDefinitions(ctx context.Context, deployed *container.Container, storeId uuid.UUID, customers []CustomerView) ([]SegmentDefinition, error) {
	now := deployed.Now()
	definitions := BuiltInSegments(customers, now)
	rows, err := deployed.Client.CustomerSegment.Query().Where(customersegment.StoreID(storeId)).Order(ent.Asc(customersegment.FieldID)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		definitions = append(definitions, CustomSegment(row.ID.String(), row.Name, row.Description, row.Rules, row.CreatedAt, now))
	}
	return definitions, nil
}

func FilterCustomersBySegment(ctx context.Context, deployed *container.Container, store commerceports.StoreAccess, segmentId string, customers []CustomerView) ([]CustomerView, error) {
	if segmentId == "" || !sellerplans.Default.PlanOf(ctx, store.OwnerAccountId).AtLeast(sellerplans.MinimumPlanFor("customer_segments")) {
		return customers, nil
	}
	definitions, err := LoadSegmentDefinitions(ctx, deployed, store.StoreId, customers)
	if err != nil {
		return nil, err
	}
	for _, definition := range definitions {
		if definition.Id == segmentId {
			return definition.Members(customers), nil
		}
	}
	return nil, ordererrors.SegmentNotFound
}
