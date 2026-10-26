package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strings"

	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/registrationblock"
)

func HashBlockedIdentifier(pepper []byte, kind, value string) string {
	mac := hmac.New(sha256.New, pepper)
	mac.Write([]byte(kind + "\x00" + strings.ToLower(strings.TrimSpace(value))))
	return hex.EncodeToString(mac.Sum(nil))
}

func AssertSignupIsNotBlockedInTransaction(ctx context.Context, tx *ent.Tx, pepper []byte, email, deviceId string) error {
	hashes := map[registrationblock.Kind]string{}
	if email != "" {
		hashes[registrationblock.KindEmail] = HashBlockedIdentifier(pepper, "email", email)
	}
	if deviceId != "" {
		hashes[registrationblock.KindDevice] = HashBlockedIdentifier(pepper, "device", deviceId)
	}
	for kind, hash := range hashes {
		blocked, err := tx.RegistrationBlock.Query().Where(registrationblock.KindEQ(kind), registrationblock.ValueHash(hash), registrationblock.LiftedAtIsNil()).Exist(ctx)
		if err != nil {
			return err
		}
		if blocked {
			return authErrors.ErrSignupBlocked
		}
	}
	return nil
}
