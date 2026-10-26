package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/shippingaddress"
)

func LockAddressesOfAccountInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID) ([]*ent.ShippingAddress, error) {
	return tx.ShippingAddress.Query().Where(shippingaddress.AccountID(accountId)).Order(ent.Desc(shippingaddress.FieldID)).ForUpdate().All(ctx)
}

func ClearDefaultFlagExceptInTransaction(ctx context.Context, tx *ent.Tx, accountId, keepId uuid.UUID) error {
	return tx.ShippingAddress.Update().Where(shippingaddress.AccountID(accountId), shippingaddress.IDNEQ(keepId), shippingaddress.IsDefault(true)).SetIsDefault(false).Exec(ctx)
}
