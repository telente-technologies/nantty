package services

import (
	"context"
	"strconv"
	"time"

	"github.com/google/uuid"

	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/legalversion"
	"nantty/modules/users/src/generated/ent/termsacceptance"
)

func CurrentPublishedVersion(ctx context.Context, client *ent.Client, documentKey string) (*ent.LegalVersion, error) {
	row, err := client.LegalVersion.Query().Where(legalversion.DocumentKey(documentKey), legalversion.StatusEQ(legalversion.StatusPublished)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func RecordPolicyAcceptance(ctx context.Context, client *ent.Client, accountId uuid.UUID, rawVersionId, ipAddress, userAgent string, now time.Time) error {
	versionId, err := uuid.Parse(rawVersionId)
	if err != nil {
		return usersErrors.UnprocessableWithCode("POLICY_VERSION_NOT_CURRENT", "That policy version is not current.")
	}
	version, err := client.LegalVersion.Get(ctx, versionId)
	if ent.IsNotFound(err) || (err == nil && version.Status != legalversion.StatusPublished) {
		return usersErrors.UnprocessableWithCode("POLICY_VERSION_NOT_CURRENT", "That policy version is not current.")
	}
	if err != nil {
		return err
	}
	label := version.DocumentKey + "@v" + VersionNumberText(version.VersionNumber)
	err = client.TermsAcceptance.Create().SetAccountID(accountId).SetTermsVersion(label).SetPolicyVersionID(version.ID).SetAcceptedAt(now).SetIPAddress(ipAddress).SetUserAgent(userAgent).Exec(ctx)
	if ent.IsConstraintError(err) {
		return nil
	}
	return err
}

func AcceptedPolicyVersionIds(ctx context.Context, client *ent.Client, accountId uuid.UUID) ([]string, error) {
	rows, err := client.TermsAcceptance.Query().Where(termsacceptance.AccountID(accountId), termsacceptance.PolicyVersionIDNotNil()).All(ctx)
	identifiers := make([]string, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.PolicyVersionID.String())
	}
	return identifiers, err
}

func VersionNumberText(value int) string { return strconv.Itoa(value) }
