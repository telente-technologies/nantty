package createaccountbyadmin

import (
	"context"
	"errors"
	"strings"
	"unicode"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/admincreatedaccount"
	"nantty/modules/users/src/generated/ent/profile"
	accountservices "nantty/modules/users/src/modules/accountEnforcement/services"
	"nantty/modules/users/src/modules/checkmarks/services"
	usersservices "nantty/modules/users/src/services"
	"nantty/platform/identityports"
	"nantty/platform/usernames"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (services.AdminCreatedAccountView, error) {
	if err := services.RequireSuperadmin(command.Actor); err != nil {
		return services.AdminCreatedAccountView{}, err
	}
	reason, err := accountservices.RequireReason(command.Reason)
	if err != nil {
		return services.AdminCreatedAccountView{}, err
	}
	username := usernames.NormalizeRequestedUsername(command.Username)
	profileType := strings.ToLower(command.ProfileType)
	email := strings.ToLower(strings.TrimSpace(command.Email))
	if err := validate(username, email, command.Password, profileType); err != nil {
		return services.AdminCreatedAccountView{}, err
	}
	bypassed, err := handler.matchedReservedEntries(ctx, username)
	if err != nil {
		return services.AdminCreatedAccountView{}, err
	}
	enforcement, err := identityports.Default.AccountEnforcement()
	if err != nil {
		return services.AdminCreatedAccountView{}, err
	}
	accountId, err := enforcement.CreateAccountOnBehalf(ctx, identityports.CreateAccountRequest{Username: username, Name: strings.TrimSpace(command.DisplayName), Email: email, Password: command.Password})
	if errors.Is(err, identityports.ErrUsernameAlreadyTaken) {
		return services.AdminCreatedAccountView{}, usersErrors.Conflict("USERNAME_TAKEN", "That username is taken.")
	}
	if errors.Is(err, identityports.ErrEmailAlreadyTaken) {
		return services.AdminCreatedAccountView{}, usersErrors.Conflict("EMAIL_TAKEN", "That email already has an account.")
	}
	if err != nil {
		return services.AdminCreatedAccountView{}, err
	}
	var created *ent.AdminCreatedAccount
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		builder := tx.Profile.Create().SetAccountID(accountId).SetKind(profile.KindPersonal).SetHandle(username).SetDisplayName(usersservices.TruncateRunes(command.DisplayName, 80)).SetProfileType(profile.ProfileType(profileType))
		if len(command.Country) == 2 {
			builder.SetCountryCode(strings.ToUpper(command.Country))
		}
		if err := builder.Exec(ctx); err != nil {
			return err
		}
		if err := tx.UsernameChange.Create().SetAccountID(accountId).SetPreviousUsername(username).SetNewUsername(username).SetReason("signup").Exec(ctx); err != nil {
			return err
		}
		if created, err = tx.AdminCreatedAccount.Create().SetAccountID(accountId).SetProfileType(admincreatedaccount.ProfileType(profileType)).SetCreatedBy(command.Actor.Id).SetCreatedByName(command.Actor.Name).SetReason(reason).SetBypassedReservedEntries(bypassed).Save(ctx); err != nil {
			return err
		}
		return usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
			Action: "account.created_by_admin", SubjectType: "user", SubjectId: accountId.String(), SubjectLabel: username, Reason: reason,
			After: map[string]any{"username": username, "profileType": profileType, "bypassedReservedEntries": bypassed, "mustChangePassword": true},
		})
	})
	if err != nil {
		return services.AdminCreatedAccountView{}, err
	}
	return services.BuildAdminCreatedAccountView(ctx, handler.Container, created)
}

func (handler Handler) matchedReservedEntries(ctx context.Context, username string) ([]string, error) {
	rules, err := usersservices.ListReservedRules(ctx, handler.Container.Client)
	if err != nil {
		return nil, err
	}
	matched := []string{}
	if rule, found := usernames.FindMatchingReservedRule(username, rules); found {
		matched = append(matched, rule.Term)
	}
	return matched, nil
}

func validate(username, email, password, profileType string) error {
	if !usernames.HasValidFormat(username) {
		return usersErrors.ValidationFailedFor("username", "is not a valid username")
	}
	if !strings.Contains(email, "@") || len(email) > 254 {
		return usersErrors.ValidationFailedFor("email", "must be a valid email address")
	}
	if profileType != "personal" && profileType != "business" && profileType != "brand" && profileType != "government" {
		return usersErrors.ValidationFailedFor("profileType", "must be PERSONAL, BUSINESS, BRAND or GOVERNMENT")
	}
	hasUpper, hasLower, hasDigit := false, false, false
	for _, character := range password {
		hasUpper, hasLower, hasDigit = hasUpper || unicode.IsUpper(character), hasLower || unicode.IsLower(character), hasDigit || unicode.IsDigit(character)
	}
	if len(password) < 12 || len(password) > 128 || !hasUpper || !hasLower || !hasDigit {
		return usersErrors.ValidationFailedFor("password", "must be 12 to 128 characters with upper case, lower case and a digit")
	}
	return nil
}
