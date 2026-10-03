package services

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/privacysetting"
	"zudomart/platform/identityports"
)

type Recipient struct {
	AccountId        string          `json:"accountId"`
	Email            *string         `json:"email"`
	EmailVerified    bool            `json:"emailVerified"`
	FirstName        string          `json:"firstName"`
	Name             string          `json:"name"`
	Username         string          `json:"username"`
	Locale           string          `json:"locale"`
	MarketingConsent bool            `json:"marketingConsent"`
	Status           string          `json:"status"`
	Preferences      map[string]bool `json:"preferences"`
}

func firstNameOf(name string) string {
	if fields := strings.Fields(name); len(fields) > 0 {
		return fields[0]
	}
	return ""
}

func BuildRecipient(ctx context.Context, application *container.Container, summary identityports.AccountSummary) (Recipient, error) {
	recipient := Recipient{
		AccountId: summary.ID.String(), Email: summary.Email, EmailVerified: summary.EmailVerified, FirstName: firstNameOf(summary.Name), Name: summary.Name, Username: summary.Username, Locale: "en",
		Status: summary.Status, Preferences: map[string]bool{"marketing": false, "analytics": false, "personalization": false, "personalizedAds": false},
	}
	settings, err := application.Client.PrivacySetting.Query().Where(privacysetting.AccountID(summary.ID)).Only(ctx)
	if ent.IsNotFound(err) {
		return recipient, nil
	}
	if err != nil {
		return recipient, err
	}
	recipient.MarketingConsent = settings.Marketing
	recipient.Preferences = map[string]bool{"marketing": settings.Marketing, "analytics": settings.Analytics, "personalization": settings.Personalization, "personalizedAds": settings.PersonalizedAds}
	return recipient, nil
}

func FindRecipient(ctx context.Context, application *container.Container, accountId uuid.UUID) (Recipient, bool, error) {
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return Recipient{}, false, err
	}
	summary, found, err := directory.FindAccountSummary(ctx, accountId)
	if err != nil || !found {
		return Recipient{}, false, err
	}
	recipient, err := BuildRecipient(ctx, application, summary)
	return recipient, true, err
}

func FindRecipientByUsername(ctx context.Context, application *container.Container, username string) (Recipient, bool, error) {
	directory, err := identityports.Default.AccountDirectory()
	if err != nil {
		return Recipient{}, false, err
	}
	summary, found, err := directory.FindAccountSummaryByUsername(ctx, strings.ToLower(strings.TrimPrefix(username, "@")))
	if err != nil || !found {
		return Recipient{}, false, err
	}
	recipient, err := BuildRecipient(ctx, application, summary)
	return recipient, true, err
}
