package application

import (
	"time"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/totp"
	"zudomart/platform/secretbox"
)

func (application *AdminApplication) sealNewTotpSecret() (secret []byte, sealed []byte, err error) {
	if secret, err = totp.GenerateSecret(); err != nil {
		return nil, nil, err
	}
	sealed, err = secretbox.SealWithAesGcm(application.Settings.TotpEncryptionKey, secret)
	return secret, sealed, err
}

func (application *AdminApplication) checkTotpCodeAgainstStaff(staff *ent.StaffAccount, code string, now time.Time) (int64, bool, error) {
	if len(staff.TotpSecretEncrypted) == 0 {
		return 0, false, errMfaNotEnrolled
	}
	secret, err := secretbox.OpenWithAesGcm(application.Settings.TotpEncryptionKey, staff.TotpSecretEncrypted)
	if err != nil {
		return 0, false, err
	}
	step, matched := totp.VerifyCodeRejectingReplays(secret, code, now, staff.TotpLastUsedStep)
	return step, matched, nil
}
