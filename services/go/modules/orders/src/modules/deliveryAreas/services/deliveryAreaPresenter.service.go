package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/generated/ent"
	"zudomart/modules/orders/src/generated/ent/deliveryarea"
	"zudomart/modules/orders/src/modules/deliveryAreas/dtos"
	"zudomart/platform/money"
)

func PresentDeliveryArea(row *ent.DeliveryArea) dtos.DeliveryAreaView {
	return dtos.DeliveryAreaView{Id: row.ID.String(), Name: row.Name, State: row.State, Cities: row.Cities, Fee: money.Money{AmountMinor: row.FeeMinor, Currency: money.CurrencyCode(row.Currency)},
		EstimatedDaysMin: row.EstimatedDaysMin, EstimatedDaysMax: row.EstimatedDaysMax, Active: row.Active}
}

func ValuesOf(row *ent.DeliveryArea) dtos.DeliveryAreaValues {
	return dtos.DeliveryAreaValues{Name: row.Name, State: row.State, Cities: row.Cities, FeeMinor: row.FeeMinor, EstimatedDaysMin: row.EstimatedDaysMin, EstimatedDaysMax: row.EstimatedDaysMax, Active: row.Active}
}

func CleanCities(cities []string) []string {
	cleaned := make([]string, 0, len(cities))
	for _, city := range cities {
		cleaned = append(cleaned, strings.TrimSpace(city))
	}
	return cleaned
}

type DeliveryAreaNames struct {
	Container *container.Container
}

func (names DeliveryAreaNames) DeliveryAreaNamesForStore(ctx context.Context, storeId uuid.UUID) ([]string, error) {
	rows, err := names.Container.Client.DeliveryArea.Query().Where(deliveryarea.StoreID(storeId), deliveryarea.Active(true)).Order(ent.Asc(deliveryarea.FieldName)).All(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]string, 0, len(rows))
	for _, row := range rows {
		result = append(result, row.Name+", "+row.State)
	}
	return result, nil
}
