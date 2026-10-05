package services

import (
	"context"

	"github.com/google/uuid"

	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/generated/ent/staffloginchallenge"
	"zudomart/modules/admin/src/modules/staffAuth/models"
	"zudomart/modules/admin/src/repositories"
	"zudomart/modules/admin/src/types"
	jsonencoding "zudomart/modules/admin/src/utils/jsonEncoding"
	secrettokens "zudomart/modules/admin/src/utils/secretTokens"
	"zudomart/platform/identityports"
)

func (service StaffAuthService) FindUsableChallengeInTransaction(ctx context.Context, tx *ent.Tx, challengeToken string, purpose staffloginchallenge.Purpose) (*ent.StaffLoginChallenge, error) {
	challenge, err := tx.StaffLoginChallenge.Query().
		Where(staffloginchallenge.TokenHash(secrettokens.HashOpaqueTokenForStorage(challengeToken)), staffloginchallenge.PurposeEQ(purpose),
			staffloginchallenge.ConsumedAtIsNil(), staffloginchallenge.ExpiresAtGT(service.Container.Now())).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, adminerrors.InvalidChallenge
	}
	return challenge, err
}

func (service StaffAuthService) CompleteMfaChallenge(ctx context.Context, challengeToken string, proof SecondFactorProof, purpose staffloginchallenge.Purpose) (models.StaffSessionResult, error) {
	var rejection error
	var staff *ent.StaffAccount
	var sessionId uuid.UUID
	var refreshToken string
	var recoveryCodes []string
	err := service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := service.Container.Now()
		challenge, err := service.FindUsableChallengeInTransaction(ctx, tx, challengeToken, purpose)
		if err != nil {
			if IsRejection(err) {
				rejection = err
				return nil
			}
			return err
		}
		if staff, err = tx.StaffAccount.Query().Where(staffaccount.ID(challenge.StaffID)).ForUpdate().Only(ctx); err != nil {
			return err
		}
		if staff.Status != staffaccount.StatusActive {
			rejection = adminerrors.InvalidChallenge
			return nil
		}
		if !service.StaffAddressAllowed(staff, types.ClientDetailsFromContext(ctx).IpAddress) {
			rejection = adminerrors.IpNotAllowed
			return nil
		}
		matched, err := service.VerifySecondFactorInTransaction(ctx, tx, staff, proof, challenge.WebauthnSession, now)
		if err != nil {
			if IsRejection(err) {
				rejection = err
				return nil
			}
			return err
		}
		if !matched || challenge.Attempts >= service.Container.Settings.MaximumFailedPasswords {
			rejection = adminerrors.InvalidMfaCode
			return service.registerFailedChallengeAttemptInTransaction(ctx, tx, challenge, &rejection)
		}
		if err := challenge.Update().SetConsumedAt(now).ClearWebauthnSession().Exec(ctx); err != nil {
			return err
		}
		action := "staff.logged_in"
		if purpose == staffloginchallenge.PurposeEnroll {
			action = "staff.mfa_enrolled"
			if err := tx.StaffAccount.UpdateOneID(staff.ID).SetTotpConfirmedAt(now).Exec(ctx); err != nil {
				return err
			}
			if recoveryCodes, err = service.IssueRecoveryCodesInTransaction(ctx, tx, staff); err != nil {
				return err
			}
		}
		if staff, err = tx.StaffAccount.Get(ctx, staff.ID); err != nil {
			return err
		}
		if sessionId, refreshToken, err = service.StartSessionInTransaction(ctx, tx, staff); err != nil {
			return err
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: staff.ID.String(), ActorRole: string(staff.Role), Action: action, SubjectType: "staff", SubjectId: staff.ID.String(), SubjectLabel: staff.Email,
			After: jsonencoding.MustMarshalJson(map[string]string{"method": proof.MethodName(), "sessionId": sessionId.String()}),
		})
	})
	if err != nil {
		return models.StaffSessionResult{}, err
	}
	if rejection != nil {
		return models.StaffSessionResult{}, rejection
	}
	result, err := service.BuildSessionResult(ctx, staff, sessionId, refreshToken)
	result.RecoveryCodes = recoveryCodes
	return result, err
}

func (service StaffAuthService) registerFailedChallengeAttemptInTransaction(ctx context.Context, tx *ent.Tx, challenge *ent.StaffLoginChallenge, rejection *error) error {
	update := challenge.Update().AddAttempts(1)
	if challenge.Attempts+1 >= service.Container.Settings.MaximumFailedPasswords {
		update.SetConsumedAt(service.Container.Now())
		*rejection = adminerrors.TooManyMfaAttempts
	}
	return update.Exec(ctx)
}
