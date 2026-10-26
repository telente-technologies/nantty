package services

import (
	"context"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/shippingaddress"
	"nantty/platform/usersdirectory"
)

const backfillBatch = 200

func SealPlaintextPhones(ctx context.Context, client *ent.Client, key []byte) error {
	if len(key) == 0 {
		return nil
	}
	for {
		rows, err := client.ShippingAddress.Query().Where(shippingaddress.PhoneNEQ(""), shippingaddress.PhoneSealedIsNil()).Limit(backfillBatch).All(ctx)
		if err != nil || len(rows) == 0 {
			return err
		}
		for _, row := range rows {
			_, sealed, err := usersdirectory.SealAddressPhone(key, row.Phone)
			if err != nil {
				return err
			}
			if err := client.ShippingAddress.UpdateOne(row).SetPhone("").SetPhoneSealed(sealed).Exec(ctx); err != nil {
				return err
			}
		}
	}
}
