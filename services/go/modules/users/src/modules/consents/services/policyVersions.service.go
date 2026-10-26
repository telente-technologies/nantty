package services

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/policyversion"
	"nantty/modules/users/src/modules/consents/models"
	"nantty/platform/httpserver"
)

var PolicyKinds = []string{models.PolicyPrivacy, models.PolicyCookie, models.PolicyTerms}

func CurrentPolicyVersions(ctx context.Context, client *ent.Client, now time.Time) (map[string]*ent.PolicyVersion, error) {
	current := map[string]*ent.PolicyVersion{}
	for _, kind := range PolicyKinds {
		row, err := client.PolicyVersion.Query().
			Where(policyversion.KindEQ(policyversion.Kind(kind)), policyversion.EffectiveAtLTE(now)).
			Order(ent.Desc(policyversion.FieldEffectiveAt), ent.Desc(policyversion.FieldID)).First(ctx)
		if ent.IsNotFound(err) {
			continue
		}
		if err != nil {
			return nil, err
		}
		current[kind] = row
	}
	return current, nil
}

func SeedInitialPolicyVersionsIfMissing(ctx context.Context, client *ent.Client) error {
	effective := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	for _, kind := range PolicyKinds {
		exists, err := client.PolicyVersion.Query().Where(policyversion.KindEQ(policyversion.Kind(kind))).Exist(ctx)
		if err != nil || exists {
			if err != nil {
				return err
			}
			continue
		}
		err = client.PolicyVersion.Create().SetKind(policyversion.Kind(kind)).SetVersion("1.0").SetEffectiveAt(effective).
			SetSummary("Initial placeholder version. Replace through the admin console after legal review.").SetPublishedBy("system").Exec(ctx)
		if err != nil && !ent.IsConstraintError(err) {
			return err
		}
	}
	return nil
}

func RequireCurrentVersion(current map[string]*ent.PolicyVersion, kind, presented string) (string, error) {
	row, found := current[kind]
	if !found {
		return "", httpserver.NewApiError(http.StatusServiceUnavailable, "POLICY_NOT_PUBLISHED", "This policy is not available right now.")
	}
	if presented != "" && presented != row.Version {
		return "", &httpserver.ApiError{
			Status: http.StatusConflict, Code: "STALE_POLICY_VERSION", Message: fmt.Sprintf("A newer %s is in force. Review it and try again.", kind),
			Issues: []httpserver.ValidationIssue{{Path: "policyVersion", Message: "current version is " + row.Version}},
		}
	}
	return row.Version, nil
}

var ErrTermsVersionRequired = httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "termsVersion", Message: "is required"}})
