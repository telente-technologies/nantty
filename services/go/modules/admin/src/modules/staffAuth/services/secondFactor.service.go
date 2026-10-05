package services

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"zudomart/modules/admin/src/generated/ent"
	recoverycodes "zudomart/modules/admin/src/utils/recoveryCodes"
	ipallowlist "zudomart/modules/admin/src/utils/ipAllowList"
	"zudomart/platform/httpserver"
)

type SecondFactorProof struct {
	Method     string
	Code       string
	Credential json.RawMessage
}

func (proof SecondFactorProof) MethodName() string {
	if proof.Method == "" {
		return "totp"
	}
	return proof.Method
}

func (service StaffAuthService) VerifySecondFactorInTransaction(ctx context.Context, tx *ent.Tx, staff *ent.StaffAccount, proof SecondFactorProof, webauthnSession []byte, now time.Time) (bool, error) {
	switch proof.MethodName() {
	case "recovery":
		if staff.TotpConfirmedAt == nil {
			return false, nil
		}
		remaining, matched := recoverycodes.Consume(service.Container.RecoveryCodeKey(), staff.RecoveryCodeHashes, proof.Code)
		if !matched {
			return false, nil
		}
		return true, tx.StaffAccount.UpdateOneID(staff.ID).SetRecoveryCodeHashes(remaining).Exec(ctx)
	case "webauthn":
		return service.VerifyPasskeyAssertionInTransaction(ctx, tx, staff, webauthnSession, proof.Credential)
	}
	step, matched, err := service.CheckTotpCodeAgainstStaff(staff, proof.Code, now)
	if err != nil || !matched {
		return false, err
	}
	return true, tx.StaffAccount.UpdateOneID(staff.ID).SetTotpLastUsedStep(step).Exec(ctx)
}

func (service StaffAuthService) IssueRecoveryCodesInTransaction(ctx context.Context, tx *ent.Tx, staff *ent.StaffAccount) ([]string, error) {
	codes, err := recoverycodes.Generate()
	if err != nil {
		return nil, err
	}
	return codes, tx.StaffAccount.UpdateOneID(staff.ID).SetRecoveryCodeHashes(recoverycodes.HashAll(service.Container.RecoveryCodeKey(), codes)).Exec(ctx)
}

func (service StaffAuthService) StaffAddressAllowed(staff *ent.StaffAccount, address string) bool {
	return ipallowlist.IsAddressAllowed(address, service.Container.Settings.IpAllowList) && ipallowlist.IsAddressAllowed(address, staff.IPAllowList)
}

func IsRejection(err error) bool {
	var apiError *httpserver.ApiError
	return errors.As(err, &apiError)
}
