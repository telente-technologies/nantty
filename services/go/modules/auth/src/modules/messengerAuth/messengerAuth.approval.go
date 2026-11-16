package messengerauth

import (
	"context"
	"crypto/subtle"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/account"
	"nantty/modules/auth/src/generated/ent/messengerauthorization"
	"nantty/modules/auth/src/generated/ent/onetimecode"
	sendonetimecode "nantty/modules/auth/src/modules/oneTimeCodes/commands/sendOneTimeCode"
	verifyonetimecode "nantty/modules/auth/src/modules/oneTimeCodes/commands/verifyOneTimeCode"
	"nantty/modules/auth/src/services"
	"nantty/modules/auth/src/utils"
)

func (service Service) Approve(ctx context.Context, accountID, sessionID, authorizationID string) error {
	return service.setDecision(ctx, accountID, sessionID, authorizationID, "approved", "approve")
}

func (service Service) Deny(ctx context.Context, accountID, sessionID, authorizationID string) error {
	return service.setDecision(ctx, accountID, sessionID, authorizationID, "denied", "deny")
}

func (service Service) setDecision(ctx context.Context, accountID, sessionID, authorizationID, nextStatus, method string) error {
	owner, err := uuid.Parse(accountID)
	if err != nil {
		return errInvalidAuthorization
	}
	id, err := uuid.Parse(authorizationID)
	if err != nil {
		return errInvalidAuthorization
	}
	var username string
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.MessengerAuthorization.Query().Where(
			messengerauthorization.ID(id), messengerauthorization.AccountID(owner),
		).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidAuthorization
		}
		if err != nil {
			return err
		}
		if !row.ExpiresAt.After(service.Now()) {
			return errAuthorizationExpired
		}
		if row.Status != messengerauthorization.StatusPending {
			return errAuthorizationState
		}
		accountRecord, err := tx.Account.Get(ctx, owner)
		if err != nil {
			return err
		}
		username = accountRecord.Username
		update := row.Update().SetStatus(messengerauthorization.Status(nextStatus)).SetApprovalMethod(method).SetApprovedBySessionID(uuid.MustParse(sessionID))
		return update.Exec(ctx)
	})
	if err == nil {
		services.RecordAccountSecurityEvent(ctx, service.Container, owner, username, "messenger.login_authorization."+method+"d", map[string]any{"authorizationId": id.String(), "sessionId": sessionID})
	}
	return err
}

func (service Service) IssueCode(ctx context.Context, accountID, sessionID, authorizationID string) (CodeResponse, error) {
	owner, err := uuid.Parse(accountID)
	if err != nil {
		return CodeResponse{}, errInvalidAuthorization
	}
	id, err := uuid.Parse(authorizationID)
	if err != nil {
		return CodeResponse{}, errInvalidAuthorization
	}
	code, err := utils.GenerateSixDigitOneTimeCode()
	if err != nil {
		return CodeResponse{}, err
	}
	now := service.Now()
	var username string
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.MessengerAuthorization.Query().Where(
			messengerauthorization.ID(id), messengerauthorization.AccountID(owner),
		).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidAuthorization
		}
		if err != nil {
			return err
		}
		if !row.ExpiresAt.After(now) {
			return errAuthorizationExpired
		}
		if row.Status != messengerauthorization.StatusPending {
			return errAuthorizationState
		}
		if row.CodeIssuedAt != nil && now.Sub(*row.CodeIssuedAt) < codeResendCooldown {
			return errCodeCooldown
		}
		accountRecord, err := tx.Account.Get(ctx, owner)
		if err != nil {
			return err
		}
		username = accountRecord.Username
		return row.Update().SetCodeHash(utils.HashOneTimeCodeWithPepper(service.Settings.OneTimeCodePepper, id.String(), "messenger_authorization", code)).
			SetCodeIssuedAt(now).SetCodeExpiresAt(minTime(row.ExpiresAt, now.Add(authorizationCodeTTL))).SetCodeAttempts(0).
			SetApprovalMethod("code").SetApprovedBySessionID(uuid.MustParse(sessionID)).Exec(ctx)
	})
	if err == nil {
		services.RecordAccountSecurityEvent(ctx, service.Container, owner, username, "messenger.login_authorization.code_issued", map[string]any{"authorizationId": id.String(), "sessionId": sessionID})
	}
	if err != nil {
		return CodeResponse{}, err
	}
	return CodeResponse{AuthorizationID: id.String(), Code: code, ExpiresAt: minTime(now.Add(authorizationCodeTTL), now.Add(authorizationTTL)).UTC().Format(time.RFC3339)}, nil
}

func (service Service) VerifyCode(ctx context.Context, authorizationID, proof, code string) error {
	id, err := uuid.Parse(authorizationID)
	if err != nil {
		return errInvalidAuthorization
	}
	proofHash := utils.HashOpaqueTokenForStorage(proof)
	var outcome error
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.MessengerAuthorization.Query().Where(messengerauthorization.ID(id), messengerauthorization.ProofHash(proofHash)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidAuthorization
		}
		if err != nil {
			return err
		}
		now := service.Now()
		if !row.ExpiresAt.After(now) {
			return errAuthorizationExpired
		}
		if row.Status != messengerauthorization.StatusPending {
			if row.Status == messengerauthorization.StatusDenied {
				return errAuthorizationDenied
			}
			return errAuthorizationState
		}
		if row.CodeAttempts >= maxCodeAttempts {
			outcome = errCodeAttempts
			return row.Update().SetStatus(messengerauthorization.StatusDenied).ClearCodeHash().ClearCodeExpiresAt().Exec(ctx)
		}
		if row.CodeHash == nil || row.CodeExpiresAt == nil || !row.CodeExpiresAt.After(now) {
			return errCodeInvalid
		}
		expected := utils.HashOneTimeCodeWithPepper(service.Settings.OneTimeCodePepper, id.String(), "messenger_authorization", code)
		if subtle.ConstantTimeCompare([]byte(expected), []byte(*row.CodeHash)) != 1 {
			attempts := row.CodeAttempts + 1
			update := row.Update().SetCodeAttempts(attempts)
			if attempts >= maxCodeAttempts {
				update.SetStatus(messengerauthorization.StatusDenied).ClearCodeHash().ClearCodeExpiresAt()
			}
			if err := update.Exec(ctx); err != nil {
				return err
			}
			if attempts >= maxCodeAttempts {
				outcome = errCodeAttempts
			} else {
				outcome = errCodeInvalid
			}
			return nil
		}
		return row.Update().SetStatus(messengerauthorization.StatusApproved).SetApprovalMethod("code").ClearCodeHash().ClearCodeExpiresAt().Exec(ctx)
	})
	if err != nil {
		return err
	}
	return outcome
}

func (service Service) SendRecoveryEmail(ctx context.Context, authorizationID, proof string) (RecoveryEmailResponse, error) {
	row, err := service.pendingByProof(ctx, authorizationID, proof)
	if err != nil {
		return RecoveryEmailResponse{}, err
	}
	if !row.ExpiresAt.After(service.Now()) {
		return RecoveryEmailResponse{}, errAuthorizationExpired
	}
	if row.Status != messengerauthorization.StatusPending {
		return RecoveryEmailResponse{}, errAuthorizationState
	}
	owner, err := service.Client.Account.Get(ctx, row.AccountID)
	if err != nil {
		return RecoveryEmailResponse{}, err
	}
	if (owner.Status != account.StatusActive && owner.Status != account.StatusSuspended) || owner.Email == nil || owner.EmailVerifiedAt == nil {
		return RecoveryEmailResponse{}, errRecoveryUnavailable
	}
	result, err := (sendonetimecode.Handler{Container: service.Container}).Execute(ctx, sendonetimecode.Command{
		Destination: *owner.Email, Purpose: string(onetimecode.PurposeLogin),
	})
	if err != nil {
		return RecoveryEmailResponse{}, err
	}
	return RecoveryEmailResponse{Status: "sent", DestinationHint: maskEmail(*owner.Email), ExpiresIn: result.ExpiresIn}, nil
}

func (service Service) VerifyRecoveryEmail(ctx context.Context, authorizationID, proof, code string) error {
	row, err := service.pendingByProof(ctx, authorizationID, proof)
	if err != nil {
		return err
	}
	if !row.ExpiresAt.After(service.Now()) {
		return errAuthorizationExpired
	}
	if row.Status != messengerauthorization.StatusPending {
		return errAuthorizationState
	}
	owner, err := service.Client.Account.Get(ctx, row.AccountID)
	if err != nil {
		return err
	}
	if (owner.Status != account.StatusActive && owner.Status != account.StatusSuspended) || owner.Email == nil || owner.EmailVerifiedAt == nil {
		return errRecoveryUnavailable
	}
	verified, err := (verifyonetimecode.Handler{Container: service.Container}).Execute(ctx, verifyonetimecode.Command{
		Destination: *owner.Email, Code: code, Purpose: string(onetimecode.PurposeLogin),
	})
	if err != nil {
		return err
	}
	authorizationUUID, _ := uuid.Parse(authorizationID)
	proofHash := utils.HashOpaqueTokenForStorage(proof)
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		locked, err := tx.MessengerAuthorization.Query().Where(
			messengerauthorization.ID(authorizationUUID), messengerauthorization.ProofHash(proofHash),
		).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return errInvalidAuthorization
		}
		if err != nil {
			return err
		}
		now := service.Now()
		if !locked.ExpiresAt.After(now) {
			return errAuthorizationExpired
		}
		if locked.Status != messengerauthorization.StatusPending {
			return errAuthorizationState
		}
		verifiedEmail, err := services.ConsumeVerifiedDestinationTokenInTransaction(ctx, tx, onetimecode.PurposeLoginVerified, verified.OtpToken, service.Now)
		if err != nil || verifiedEmail != *owner.Email {
			return errRecoveryUnavailable
		}
		return locked.Update().SetStatus(messengerauthorization.StatusApproved).SetApprovalMethod("email_recovery").ClearCodeHash().ClearCodeExpiresAt().Exec(ctx)
	})
	if err == nil {
		services.RecordAccountSecurityEvent(ctx, service.Container, owner.ID, owner.Username, "messenger.login_authorization.email_recovery_verified", map[string]any{"authorizationId": authorizationUUID.String()})
	}
	return err
}

func maskEmail(email string) string {
	local, domain, found := strings.Cut(email, "@")
	if !found || local == "" {
		return ""
	}
	return local[:1] + "***@" + domain
}
