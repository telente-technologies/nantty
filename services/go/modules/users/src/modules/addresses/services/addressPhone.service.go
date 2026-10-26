package services

import (
	"nantty/modules/users/src/generated/ent"
	"nantty/platform/usersdirectory"
)

type phoneSetter[Builder any] interface {
	SetPhone(string) Builder
	SetPhoneSealed([]byte) Builder
}

func StorePhone[Builder any](builder phoneSetter[Builder], key []byte, phone string) error {
	plain, sealed, err := usersdirectory.SealAddressPhone(key, phone)
	if err != nil {
		return err
	}
	builder.SetPhone(plain)
	if sealed != nil {
		builder.SetPhoneSealed(sealed)
	}
	return nil
}

func OpenPhone(key []byte, address *ent.ShippingAddress) (string, error) {
	var sealed []byte
	if address.PhoneSealed != nil {
		sealed = *address.PhoneSealed
	}
	return usersdirectory.OpenAddressPhone(key, address.Phone, sealed)
}
