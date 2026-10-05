package services

import (
	"net/url"
	"regexp"
	"strings"
	"time"

	"zudomart/modules/catalog/src/databases/schema"
)

type OfficialCheck struct {
	Key     string `json:"key"`
	Label   string `json:"label"`
	Outcome string `json:"outcome"`
	Detail  string `json:"detail"`
}

var (
	registrationFormat = regexp.MustCompile(`^[A-Za-z]{0,4}[/-]?\d{2,10}([/-]\d{1,10}){0,3}$`)
	companySuffixes    = regexp.MustCompile(`\b(limited|ltd|plc|inc|llc|company|co|enterprises?|nigeria|ng)\b`)
	nonAlphanumeric    = regexp.MustCompile(`[^a-z0-9]+`)
)

func normalizeCompany(name string) string {
	lowered := companySuffixes.ReplaceAllString(strings.ToLower(name), " ")
	return nonAlphanumeric.ReplaceAllString(lowered, "")
}

func outcome(passed bool, failure string) string {
	if passed {
		return "PASS"
	}
	return failure
}

func ComputeChecks(trademark schema.BrandTrademark, cacName, contactEmail string, website *string, hasVerifiedStore bool, now time.Time) []OfficialCheck {
	checks := []OfficialCheck{{Key: "registrationFormat", Label: "Registration number format", Outcome: outcome(registrationFormat.MatchString(strings.TrimSpace(trademark.RegistrationNumber)), "FAIL"), Detail: trademark.RegistrationNumber}}
	expiry := OfficialCheck{Key: "trademarkExpiry", Label: "Trademark expiry", Outcome: "FAIL", Detail: "Expiry date missing or invalid"}
	if expiresOn, err := time.Parse("2006-01-02", trademark.ExpiresOn); err == nil {
		expiry.Detail = "Expires " + trademark.ExpiresOn
		switch {
		case !expiresOn.After(now):
			expiry.Outcome = "FAIL"
		case expiresOn.Before(now.AddDate(0, 0, 90)):
			expiry.Outcome = "WARN"
		default:
			expiry.Outcome = "PASS"
		}
	}
	owner, company := normalizeCompany(trademark.RegisteredOwner), normalizeCompany(cacName)
	checks = append(checks, expiry, OfficialCheck{Key: "ownerMatchesCac", Label: "Trademark owner matches CAC company", Outcome: outcome(owner != "" && owner == company, "FAIL"),
		Detail: trademark.RegisteredOwner + " / " + cacName})
	emailDomain := ""
	if at := strings.LastIndex(contactEmail, "@"); at >= 0 {
		emailDomain = strings.ToLower(contactEmail[at+1:])
	}
	websiteHost := ""
	if website != nil {
		if parsed, err := url.Parse(*website); err == nil {
			websiteHost = strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
		}
	}
	matches := emailDomain != "" && websiteHost != "" && (emailDomain == websiteHost || strings.HasSuffix(emailDomain, "."+websiteHost))
	checks = append(checks, OfficialCheck{Key: "emailDomain", Label: "Contact email on the brand's website domain", Outcome: outcome(matches, "WARN"), Detail: emailDomain},
		OfficialCheck{Key: "verifiedStore", Label: "At least one linked store is Gold verified", Outcome: outcome(hasVerifiedStore, "FAIL"), Detail: ""})
	return checks
}
