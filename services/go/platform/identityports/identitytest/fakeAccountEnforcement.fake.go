package identitytest

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/platform/identityports"
)

func (directory *FakeAccountDirectory) setStatus(accountId uuid.UUID, status string) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	summary := directory.accounts[accountId]
	summary.Status, summary.Active = status, status == "active"
	directory.accounts[accountId] = summary
}

func (directory *FakeAccountDirectory) SuspendAccountAndRevokeSessions(_ context.Context, accountId uuid.UUID) error {
	directory.setStatus(accountId, "suspended")
	directory.RevokedSessions++
	return nil
}

func (directory *FakeAccountDirectory) ReinstateAccount(_ context.Context, accountId uuid.UUID) error {
	directory.setStatus(accountId, "active")
	return nil
}

func (directory *FakeAccountDirectory) BanAccountAndRevokeSessions(_ context.Context, accountId uuid.UUID, details identityports.BanDetails) error {
	directory.setStatus(accountId, "banned")
	directory.Bans = append(directory.Bans, details)
	return nil
}

func (directory *FakeAccountDirectory) LiftBan(_ context.Context, accountId uuid.UUID) error {
	directory.setStatus(accountId, "active")
	return nil
}

func (directory *FakeAccountDirectory) RevokeAccountSessions(context.Context, uuid.UUID, *uuid.UUID) error {
	directory.RevokedSessions++
	return nil
}

func (directory *FakeAccountDirectory) ListActiveAccountSessions(context.Context, uuid.UUID) ([]identityports.AccountSession, error) {
	return []identityports.AccountSession{}, nil
}

func (directory *FakeAccountDirectory) MarkAccountDeleted(_ context.Context, accountId uuid.UUID, anonymizedUsername string) error {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	summary := directory.accounts[accountId]
	summary.Status, summary.Active, summary.Username, summary.Email = "deleted", false, anonymizedUsername, nil
	directory.accounts[accountId] = summary
	return nil
}

func (directory *FakeAccountDirectory) ChangeAccountPassword(context.Context, uuid.UUID, string, bool) error {
	return nil
}

func (directory *FakeAccountDirectory) CreateAccountOnBehalf(_ context.Context, request identityports.CreateAccountRequest) (uuid.UUID, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	for _, existing := range directory.accounts {
		if existing.Username == request.Username {
			return uuid.Nil, identityports.ErrUsernameAlreadyTaken
		}
		if existing.Email != nil && strings.EqualFold(*existing.Email, request.Email) {
			return uuid.Nil, identityports.ErrEmailAlreadyTaken
		}
	}
	email := request.Email
	summary := identityports.AccountSummary{ID: uuid.New(), Username: request.Username, Name: request.Name, Email: &email, Roles: []string{"buyer"}, EmailVerified: true, Active: true, Status: "active"}
	directory.accounts[summary.ID] = summary
	return summary.ID, nil
}

func (directory *FakeAccountDirectory) SetPhoneVerified(accountId uuid.UUID) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	summary := directory.accounts[accountId]
	summary.PhoneVerified = true
	directory.accounts[accountId] = summary
}

func (directory *FakeAccountDirectory) SetAccountRole(_ context.Context, accountId uuid.UUID, role string, granted bool) error {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	summary := directory.accounts[accountId]
	roles := make([]string, 0, len(summary.Roles)+1)
	for _, existing := range summary.Roles {
		if existing != role {
			roles = append(roles, existing)
		}
	}
	if granted {
		roles = append(roles, role)
	}
	summary.Roles = roles
	directory.accounts[accountId] = summary
	return nil
}
