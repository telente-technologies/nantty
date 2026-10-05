package usersdirectory

import (
	"encoding/base64"
	"errors"
	"os"
	"strings"
	"sync"

	"zudomart/platform/secretbox"
)

const AddressPhoneKeyVariable = "ADDRESS_PHONE_ENCRYPTION_KEY"

var ErrAddressPhoneKeyMissing = errors.New("shipping address phone is encrypted but " + AddressPhoneKeyVariable + " is not set")

var environmentKey = sync.OnceValue(func() []byte {
	key, _ := DecodeAddressPhoneKey(os.Getenv(AddressPhoneKeyVariable))
	return key
})

func DecodeAddressPhoneKey(encoded string) ([]byte, error) {
	if strings.TrimSpace(encoded) == "" {
		return nil, nil
	}
	key, err := base64.StdEncoding.DecodeString(strings.TrimSpace(encoded))
	if err != nil || len(key) != 32 {
		return nil, errors.New(AddressPhoneKeyVariable + " must be base64 of 32 bytes")
	}
	return key, nil
}

func SealAddressPhone(key []byte, phone string) (plain string, sealed []byte, err error) {
	if len(key) == 0 {
		return phone, nil, nil
	}
	sealed, err = secretbox.SealWithAesGcm(key, []byte(phone))
	return "", sealed, err
}

func OpenAddressPhone(key []byte, plain string, sealed []byte) (string, error) {
	if len(sealed) == 0 {
		return plain, nil
	}
	if len(key) == 0 {
		return "", ErrAddressPhoneKeyMissing
	}
	opened, err := secretbox.OpenWithAesGcm(key, sealed)
	return string(opened), err
}

func (reader Reader) addressPhoneKey() []byte {
	if len(reader.AddressPhoneKey) > 0 {
		return reader.AddressPhoneKey
	}
	return environmentKey()
}
