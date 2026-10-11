package services

import (
	"context"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/events"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/generated/ent/registrationblock"
	"zudomart/modules/auth/src/generated/ent/session"
	"zudomart/modules/auth/src/generated/ent/socialidentity"
	"zudomart/platform/identityports"
)

type AccountEnforcementService struct {
	Container *container.Container
}

func (service AccountEnforcementService) SuspendAccountAndRevokeSessions(ctx context.Context, accountId uuid.UUID) error {
	return service.changeStatusAndRevokeSessions(ctx, accountId, account.StatusSuspended, "suspended", true)
}

func (service AccountEnforcementService) ReinstateAccount(ctx context.Context, accountId uuid.UUID) error {
	return service.changeStatusAndRevokeSessions(ctx, accountId, account.StatusActive, "active", false)
}

func (service AccountEnforcementService) changeStatusAndRevokeSessions(ctx context.Context, accountId uuid.UUID, status account.Status, newStatus string, revoke bool) error {
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := service.Container.Now()
		if err := tx.Account.UpdateOneID(accountId).SetStatus(status).Exec(ctx); err != nil {
			return err
		}
		if revoke {
			if err := revokeAllActiveSessionsInTransaction(ctx, tx, accountId, now); err != nil {
				return err
			}
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "accountStatus.changed", accountId.String(), now, events.AccountEnforcementEventData{AccountId: accountId.String(), Status: newStatus})
	})
}

func (service AccountEnforcementService) BanAccountAndRevokeSessions(ctx context.Context, accountId uuid.UUID, details identityports.BanDetails) error {
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := service.Container.Now()
		banned, err := tx.Account.UpdateOneID(accountId).SetStatus(account.StatusBanned).Save(ctx)
		if err != nil {
			return err
		}
		if details.BlockFutureSignup {
			if err := service.blockIdentifiersInTransaction(ctx, tx, banned, details); err != nil {
				return err
			}
		}
		if err := revokeAllActiveSessionsInTransaction(ctx, tx, accountId, now); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "accountStatus.changed", accountId.String(), now, events.AccountEnforcementEventData{AccountId: accountId.String(), Status: "banned"})
	})
}

func (service AccountEnforcementService) blockIdentifiersInTransaction(ctx context.Context, tx *ent.Tx, banned *ent.Account, details identityports.BanDetails) error {
	pepper := service.Container.Settings.OneTimeCodePepper
	hashes := map[registrationblock.Kind][]string{}
	if banned.Email != nil {
		hashes[registrationblock.KindEmail] = append(hashes[registrationblock.KindEmail], HashBlockedIdentifier(pepper, "email", *banned.Email))
	}
	sessions, err := tx.Session.Query().Where(session.AccountID(banned.ID), session.DeviceHashNotNil()).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range sessions {
		hashes[registrationblock.KindDevice] = append(hashes[registrationblock.KindDevice], *row.DeviceHash)
	}
	for kind, values := range hashes {
		seen := map[string]bool{}
		for _, value := range values {
			if seen[value] {
				continue
			}
			seen[value] = true
			if err := tx.RegistrationBlock.Create().SetKind(kind).SetValueHash(value).SetAccountID(banned.ID).SetReason(details.Reason).SetCreatedBy(details.BlockedBy).Exec(ctx); err != nil {
				return err
			}
		}
	}
	return nil
}

func (service AccountEnforcementService) LiftBan(ctx context.Context, accountId uuid.UUID) error {
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := service.Container.Now()
		if err := tx.Account.UpdateOneID(accountId).SetStatus(account.StatusActive).Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.RegistrationBlock.Update().Where(registrationblock.AccountID(accountId), registrationblock.LiftedAtIsNil()).SetLiftedAt(now).Save(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "accountStatus.changed", accountId.String(), now, events.AccountEnforcementEventData{AccountId: accountId.String(), Status: "active"})
	})
}

func (service AccountEnforcementService) RevokeAccountSessions(ctx context.Context, accountId uuid.UUID, onlySessionId *uuid.UUID) error {
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now, scope := service.Container.Now(), "*"
		update := tx.Session.Update().Where(session.AccountID(accountId), session.RevokedAtIsNil())
		if onlySessionId != nil {
			update, scope = update.Where(session.ID(*onlySessionId)), onlySessionId.String()
		}
		revoked, err := update.SetRevokedAt(now).SetRevokedReason(session.RevokedReasonRevokeAll).Save(ctx)
		if err != nil {
			return err
		}
		return EnqueueSessionsEndedInTransaction(ctx, tx, accountId, scope, revoked, now)
	})
}

func (service AccountEnforcementService) ListActiveAccountSessions(ctx context.Context, accountId uuid.UUID) ([]identityports.AccountSession, error) {
	rows, err := service.Container.Client.Session.Query().Where(session.AccountID(accountId), session.RevokedAtIsNil(), session.ExpiresAtGT(service.Container.Now())).Order(ent.Desc(session.FieldID)).Limit(50).All(ctx)
	if err != nil {
		return nil, err
	}
	sessions := make([]identityports.AccountSession, 0, len(rows))
	for _, row := range rows {
		sessions = append(sessions, identityports.AccountSession{ID: row.ID, IpAddress: row.IPAddress, UserAgent: row.UserAgent, StartedAt: row.CreatedAt, LastSeenAt: row.LastUsedAt})
	}
	return sessions, nil
}

func (service AccountEnforcementService) MarkAccountDeleted(ctx context.Context, accountId uuid.UUID, anonymizedUsername string) error {
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := service.Container.Now()
		if err := tx.Account.UpdateOneID(accountId).SetStatus(account.StatusDeleted).SetUsername(anonymizedUsername).SetName("").ClearEmail().ClearPasswordHash().ClearBirthday().Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.SocialIdentity.Delete().Where(socialidentity.AccountID(accountId)).Exec(ctx); err != nil {
			return err
		}
		if err := revokeAllActiveSessionsInTransaction(ctx, tx, accountId, now); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "accountStatus.changed", accountId.String(), now, events.AccountEnforcementEventData{AccountId: accountId.String(), Status: "deleted"})
	})
}

func (service AccountEnforcementService) ChangeAccountPassword(ctx context.Context, accountId uuid.UUID, newPassword string, mustChange bool) error {
	hash, err := service.Container.Passwords.HashPasswordWithArgon2id(newPassword)
	if err != nil {
		return err
	}
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.Account.UpdateOneID(accountId).SetPasswordHash(hash).SetMustChangePassword(mustChange).Exec(ctx); err != nil {
			return err
		}
		return revokeAllActiveSessionsInTransaction(ctx, tx, accountId, service.Container.Now())
	})
}

func (service AccountEnforcementService) CreateAccountOnBehalf(ctx context.Context, request identityports.CreateAccountRequest) (uuid.UUID, error) {
	hash, err := service.Container.Passwords.HashPasswordWithArgon2id(request.Password)
	if err != nil {
		return uuid.Nil, err
	}
	var created *ent.Account
	err = service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := service.Container.Now()
		email := strings.ToLower(strings.TrimSpace(request.Email))
		if exists, err := tx.Account.Query().Where(account.Email(email)).Exist(ctx); err != nil || exists {
			return FirstError(err, identityports.ErrEmailAlreadyTaken)
		}
		created, err = tx.Account.Create().SetEmail(email).SetUsername(request.Username).SetName(request.Name).SetPasswordHash(hash).SetEmailVerifiedAt(now).SetMustChangePassword(true).Save(ctx)
		if ent.IsConstraintError(err) {
			return identityports.ErrUsernameAlreadyTaken
		}
		if err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "account.registered", created.ID.String(), now, events.AccountRegisteredEventData{
			AccountId: created.ID.String(), Username: created.Username, Name: created.Name, Email: email, Method: "admin",
		})
	})
	if err != nil {
		return uuid.Nil, err
	}
	return created.ID, nil
}

func revokeAllActiveSessionsInTransaction(ctx context.Context, tx *ent.Tx, accountId uuid.UUID, now time.Time) error {
	revoked, err := tx.Session.Update().Where(session.AccountID(accountId), session.RevokedAtIsNil()).SetRevokedAt(now).SetRevokedReason(session.RevokedReasonRevokeAll).Save(ctx)
	if err != nil {
		return err
	}
	return EnqueueSessionsEndedInTransaction(ctx, tx, accountId, "*", revoked, now)
}

func (service AccountEnforcementService) SetAccountRole(ctx context.Context, accountId uuid.UUID, role string, granted bool) error {
	return service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		found, err := tx.Account.Query().Where(account.ID(accountId)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		if slices.Contains(found.Roles, role) == granted {
			return nil
		}
		roles := slices.DeleteFunc(slices.Clone(found.Roles), func(existing string) bool { return existing == role })
		if granted {
			roles = append(roles, role)
		}
		if err := tx.Account.UpdateOneID(accountId).SetRoles(roles).Exec(ctx); err != nil {
			return err
		}
		if granted {
			return nil
		}
		return revokeAllActiveSessionsInTransaction(ctx, tx, accountId, service.Container.Now())
	})
}
