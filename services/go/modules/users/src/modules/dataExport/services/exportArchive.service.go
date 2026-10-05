package services

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/privacysetting"
	"zudomart/modules/users/src/generated/ent/profile"
	"zudomart/modules/users/src/generated/ent/shippingaddress"
	"zudomart/modules/users/src/generated/ent/termsacceptance"
	"zudomart/modules/users/src/generated/ent/userconsent"
	"zudomart/modules/users/src/generated/ent/usernamechange"
	"zudomart/platform/identityports"
	"zudomart/platform/usersdirectory"
)

type ArchiveContents map[string]any

func CollectUserOwnedExportData(ctx context.Context, client *ent.Client, accountId uuid.UUID, now time.Time, addressPhoneKey []byte) (ArchiveContents, error) {
	contents := ArchiveContents{"manifest.json": map[string]any{"accountId": accountId.String(), "generatedAt": now.UTC().Format(time.RFC3339), "scope": "data held by the users service; other services contribute their own data on dataExport.requested"}}
	if directory, err := identityports.Default.AccountDirectory(); err == nil {
		if summary, found, err := directory.FindAccountSummary(ctx, accountId); err != nil {
			return nil, err
		} else if found {
			contents["account.json"] = map[string]any{"id": summary.ID.String(), "username": summary.Username, "name": summary.Name, "email": summary.Email, "birthday": summary.Birthday, "emailVerified": summary.EmailVerified, "createdAt": summary.CreatedAt}
		}
	}
	collectors := []func(context.Context, *ent.Client, uuid.UUID) (string, any, error){collectProfiles, addressCollector(addressPhoneKey), collectConsents, collectTermsAcceptances, collectUsernameHistory, collectPrivacySettings}
	for _, collect := range collectors {
		name, value, err := collect(ctx, client, accountId)
		if err != nil {
			return nil, err
		}
		contents[name] = value
	}
	return contents, nil
}

func collectProfiles(ctx context.Context, client *ent.Client, accountId uuid.UUID) (string, any, error) {
	rows, err := client.Profile.Query().Where(profile.AccountID(accountId)).All(ctx)
	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		items = append(items, map[string]any{"id": row.ID, "kind": row.Kind, "handle": row.Handle, "displayName": row.DisplayName, "bio": row.Bio, "website": row.Website, "avatarUrl": row.AvatarURL, "bannerUrl": row.BannerURL, "isPrivate": row.IsPrivate, "countryCode": row.CountryCode, "createdAt": row.CreatedAt})
	}
	return "profiles.json", items, err
}

func addressCollector(addressPhoneKey []byte) func(context.Context, *ent.Client, uuid.UUID) (string, any, error) {
	return func(ctx context.Context, client *ent.Client, accountId uuid.UUID) (string, any, error) {
		return collectAddresses(ctx, client, accountId, addressPhoneKey)
	}
}

func collectAddresses(ctx context.Context, client *ent.Client, accountId uuid.UUID, addressPhoneKey []byte) (string, any, error) {
	rows, err := client.ShippingAddress.Query().Where(shippingaddress.AccountID(accountId)).All(ctx)
	if err != nil {
		return "addresses.json", nil, err
	}
	views := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		phone, err := usersdirectory.OpenAddressPhone(addressPhoneKey, row.Phone, derefBytes(row.PhoneSealed))
		if err != nil {
			return "addresses.json", nil, err
		}
		views = append(views, map[string]any{"id": row.ID, "label": row.Label, "recipientName": row.RecipientName, "phone": phone, "line1": row.Line1, "line2": row.Line2, "postalCode": row.PostalCode, "details": row.Details, "countryCode": row.CountryCode, "regionId": row.RegionID, "adminAreaId": row.AdminAreaID, "cityId": row.CityID, "isDefault": row.IsDefault, "createdAt": row.CreatedAt})
	}
	return "addresses.json", views, nil
}

func collectConsents(ctx context.Context, client *ent.Client, accountId uuid.UUID) (string, any, error) {
	rows, err := client.UserConsent.Query().Where(userconsent.AccountID(accountId)).Order(ent.Asc(userconsent.FieldID)).All(ctx)
	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		items = append(items, map[string]any{"consentType": row.ConsentType, "status": row.Status, "policyVersion": row.PolicyVersion, "consentedAt": row.ConsentedAt, "withdrawnAt": row.WithdrawnAt, "ipAddress": row.IPAddress, "userAgent": row.UserAgent, "source": row.Source})
	}
	return "consents.json", items, err
}

func collectTermsAcceptances(ctx context.Context, client *ent.Client, accountId uuid.UUID) (string, any, error) {
	rows, err := client.TermsAcceptance.Query().Where(termsacceptance.AccountID(accountId)).All(ctx)
	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		items = append(items, map[string]any{"termsVersion": row.TermsVersion, "acceptedAt": row.AcceptedAt, "ipAddress": row.IPAddress, "userAgent": row.UserAgent})
	}
	return "termsAcceptances.json", items, err
}

func collectUsernameHistory(ctx context.Context, client *ent.Client, accountId uuid.UUID) (string, any, error) {
	rows, err := client.UsernameChange.Query().Where(usernamechange.AccountID(accountId)).Order(ent.Asc(usernamechange.FieldID)).All(ctx)
	items := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		items = append(items, map[string]any{"previousUsername": row.PreviousUsername, "newUsername": row.NewUsername, "reason": row.Reason, "changedAt": row.CreatedAt})
	}
	return "usernameHistory.json", items, err
}

func collectPrivacySettings(ctx context.Context, client *ent.Client, accountId uuid.UUID) (string, any, error) {
	row, err := client.PrivacySetting.Query().Where(privacysetting.AccountID(accountId)).Only(ctx)
	if ent.IsNotFound(err) {
		return "privacySettings.json", map[string]any{}, nil
	}
	if err != nil {
		return "privacySettings.json", nil, err
	}
	return "privacySettings.json", map[string]any{"analytics": row.Analytics, "personalization": row.Personalization, "personalizedAds": row.PersonalizedAds, "marketing": row.Marketing, "policyVersion": row.PolicyVersion, "updatedAt": row.UpdatedAt}, nil
}

func BuildZipArchive(contents ArchiveContents) ([]byte, error) {
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for name, value := range contents {
		encoded, err := json.MarshalIndent(value, "", "  ")
		if err != nil {
			return nil, err
		}
		file, err := writer.Create(name)
		if err != nil {
			return nil, err
		}
		if _, err := file.Write(encoded); err != nil {
			return nil, err
		}
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func derefBytes(value *[]byte) []byte {
	if value == nil {
		return nil
	}
	return *value
}
