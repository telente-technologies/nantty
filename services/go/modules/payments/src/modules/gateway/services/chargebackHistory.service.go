package services

import (
	"context"

	entsql "entgo.io/ent/dialect/sql"

	"zudomart/modules/ledger/src/databases"
	"zudomart/modules/payments/src/generated/ent/paymentintent"
	"zudomart/modules/payments/src/generated/ent/providerdispute"
)

func (gateway *PaymentGateway) UserHasChargebackHistory(ctx context.Context, executor databases.ExecutorQuerier, userId string) (bool, error) {
	schema := gateway.Container.Settings.Money.DatabaseSchema
	return gateway.Container.Client(executor).ProviderDispute.Query().Where(func(selector *entsql.Selector) {
		intents := entsql.Select(paymentintent.FieldID).From(entsql.Table(paymentintent.Table).Schema(schema)).Where(entsql.EQ(paymentintent.FieldOwnerUserID, userId))
		selector.Where(entsql.In(selector.C(providerdispute.FieldPaymentIntentID), intents))
	}).Exist(ctx)
}
