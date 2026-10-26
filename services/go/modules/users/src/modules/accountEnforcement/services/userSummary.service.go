package services

import (
	"context"
	"strings"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/profilecheckmark"
	"nantty/modules/users/src/generated/ent/profilesignal"
	"nantty/platform/identityports"
)

type VerificationSummary struct {
	Color        string `json:"color"`
	Tier         string `json:"tier"`
	Status       string `json:"status"`
	BadgeVisible bool   `json:"badgeVisible"`
}

type PlatformUserSummary struct {
	Id            string               `json:"id"`
	Username      string               `json:"username"`
	DisplayName   string               `json:"displayName"`
	AvatarUrl     *string              `json:"avatarUrl"`
	Country       *string              `json:"country"`
	Currency      *string              `json:"currency"`
	Status        string               `json:"status"`
	Verification  *VerificationSummary `json:"verification"`
	IsSeller      bool                 `json:"isSeller"`
	IsCreator     bool                 `json:"isCreator"`
	FollowerCount int                  `json:"followerCount"`
	JoinedAt      string               `json:"joinedAt"`
	LastActiveAt  *string              `json:"lastActiveAt"`
	StrikeCount   int                  `json:"strikeCount"`
	RiskLevel     string               `json:"riskLevel"`
	EmailMasked   *string              `json:"emailMasked"`
	PhoneMasked   *string              `json:"phoneMasked"`
	EmailVerified bool                 `json:"emailVerified"`
}

func MaskEmailAddress(email *string) *string {
	if email == nil || !strings.Contains(*email, "@") {
		return nil
	}
	local, domain, _ := strings.Cut(*email, "@")
	masked := local[:1] + strings.Repeat("*", max(len(local)-1, 2)) + "@" + domain
	return &masked
}

func riskLevelOf(score int) string {
	switch {
	case score >= 67:
		return "HIGH"
	case score >= 34:
		return "MEDIUM"
	}
	return "LOW"
}

func BuildPlatformUserSummary(ctx context.Context, application *container.Container, target Target) (PlatformUserSummary, error) {
	summary := PlatformUserSummary{
		Id: target.Account.ID.String(), Username: target.Account.Username, DisplayName: target.Account.Name, Status: strings.ToUpper(target.Account.Status),
		IsSeller: containsRole(target.Account.Roles, "seller"), JoinedAt: target.Account.CreatedAt.UTC().Format(time.RFC3339), RiskLevel: "LOW",
		EmailMasked: MaskEmailAddress(target.Account.Email), EmailVerified: target.Account.EmailVerified,
	}
	if target.Profile == nil {
		return summary, nil
	}
	row := target.Profile
	summary.DisplayName, summary.AvatarUrl, summary.Country, summary.IsCreator = row.DisplayName, row.AvatarURL, row.CountryCode, row.CreatorStatus == "approved"
	if row.CountryCode != nil {
		if resolver, err := identityports.Default.CurrencyResolver(); err == nil {
			if currency, supported := resolver.CurrencyForCountry(*row.CountryCode); supported {
				summary.Currency = &currency
			}
		}
	}
	if summary.DisplayName == "" {
		summary.DisplayName = target.Account.Name
	}
	if signal, err := application.Client.ProfileSignal.Query().Where(profilesignal.ProfileID(row.ID)).Only(ctx); err == nil {
		summary.FollowerCount, summary.RiskLevel = signal.RealFollowers, riskLevelOf(signal.RiskScore)
	} else if !ent.IsNotFound(err) {
		return summary, err
	}
	checkmark, err := application.Client.ProfileCheckmark.Query().Where(profilecheckmark.ProfileID(row.ID)).Only(ctx)
	if err == nil {
		summary.Verification = &VerificationSummary{
			Color: strings.ToUpper(string(checkmark.Color)), Tier: tierOf(checkmark.Color), Status: strings.ToUpper(string(checkmark.Status)),
			BadgeVisible: checkmark.Status == profilecheckmark.StatusVerified || checkmark.Status == profilecheckmark.StatusGrace,
		}
	} else if !ent.IsNotFound(err) {
		return summary, err
	}
	return summary, nil
}

func tierOf(color profilecheckmark.Color) string {
	switch color {
	case profilecheckmark.ColorGold:
		return "PRO"
	case profilecheckmark.ColorBlack:
		return "OFFICIAL"
	}
	return "VERIFIED"
}

func containsRole(roles []string, wanted string) bool {
	for _, role := range roles {
		if role == wanted {
			return true
		}
	}
	return false
}
