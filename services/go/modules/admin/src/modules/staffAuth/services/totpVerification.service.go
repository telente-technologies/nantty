package services

import (
	"time"

	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/utils/totp"
	"zudomart/platform/secretbox"
)

func (service StaffAuthService) SealNewTotpSecret() (secret []byte, sealed []byte, err error) {
	if secret, err = totp.GenerateSecret(); err != nil {
		return nil, nil, err
	}
	sealed, err = secretbox.SealWithAesGcm(service.Container.Settings.TotpEncryptionKey, secret)
	return secret, sealed, err
}

func (service StaffAuthService) OpenPendingTotpSecret(staff *ent.StaffAccount) ([]byte, bool) {
	if len(staff.TotpSecretEncrypted) == 0 || staff.TotpConfirmedAt != nil {
		return nil, false
	}
	secret, err := secretbox.OpenWithAesGcm(service.Container.Settings.TotpEncryptionKey, staff.TotpSecretEncrypted)
	return secret, err == nil
}

func (service StaffAuthService) CheckTotpCodeAgainstStaff(staff *ent.StaffAccount, code string, now time.Time) (int64, bool, error) {
	if len(staff.TotpSecretEncrypted) == 0 {
		return 0, false, adminerrors.MfaNotEnrolled
	}
	secret, err := secretbox.OpenWithAesGcm(service.Container.Settings.TotpEncryptionKey, staff.TotpSecretEncrypted)
	if err != nil {
		return 0, false, err
	}
	step, matched := totp.VerifyCodeRejectingReplays(secret, code, now, staff.TotpLastUsedStep)
	return step, matched, nil
}
