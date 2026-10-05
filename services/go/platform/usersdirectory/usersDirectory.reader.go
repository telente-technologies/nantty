package usersdirectory

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Reader struct {
	Database        *sql.DB
	Schema          string
	AddressPhoneKey []byte
}

type ProfileName struct {
	AccountId uuid.UUID
	ProfileId uuid.UUID
	Handle    string
	Name      string
	AvatarUrl string
	Verified  bool
}

type BusinessProfile struct {
	ProfileId   uuid.UUID
	AccountId   uuid.UUID
	Handle      string
	Name        string
	AvatarUrl   string
	CountryCode string
	Active      bool
}

type ShippingAddress struct {
	Id            uuid.UUID
	AccountId     uuid.UUID
	RecipientName string
	Phone         string
	Line1         string
	Line2         string
	PostalCode    string
	Details       string
	CountryCode   string
	RegionId      *uuid.UUID
	AdminAreaId   *uuid.UUID
	CityId        *uuid.UUID
	RegionName    string
	AdminAreaName string
	CityName      string
}

type GeoRegion struct {
	Id          uuid.UUID
	CountryCode string
	Code        string
	Name        string
}

func (reader Reader) table(name string) string {
	return pgx.Identifier{reader.Schema, name}.Sanitize()
}

func (reader Reader) PersonalProfilesByAccount(ctx context.Context, accountIds []uuid.UUID) (map[uuid.UUID]ProfileName, error) {
	result := map[uuid.UUID]ProfileName{}
	if len(accountIds) == 0 {
		return result, nil
	}
	rows, err := reader.Database.QueryContext(ctx,
		"SELECT id, account_id, handle, display_name, COALESCE(avatar_url, ''), verified FROM "+reader.table("profiles")+" WHERE kind = 'personal' AND account_id = ANY($1)", accountIds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var profile ProfileName
		if err := rows.Scan(&profile.ProfileId, &profile.AccountId, &profile.Handle, &profile.Name, &profile.AvatarUrl, &profile.Verified); err != nil {
			return nil, err
		}
		if profile.Name == "" {
			profile.Name = profile.Handle
		}
		result[profile.AccountId] = profile
	}
	return result, rows.Err()
}

func (reader Reader) FindBusinessProfile(ctx context.Context, profileId uuid.UUID) (BusinessProfile, bool, error) {
	var profile BusinessProfile
	var status string
	err := reader.Database.QueryRowContext(ctx,
		"SELECT id, account_id, handle, display_name, COALESCE(avatar_url, ''), COALESCE(country_code, ''), status FROM "+reader.table("profiles")+" WHERE id = $1 AND kind = 'business'", profileId).
		Scan(&profile.ProfileId, &profile.AccountId, &profile.Handle, &profile.Name, &profile.AvatarUrl, &profile.CountryCode, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return BusinessProfile{}, false, nil
	}
	profile.Active = status == "active"
	return profile, err == nil, err
}

func (reader Reader) FindShippingAddress(ctx context.Context, accountId, addressId uuid.UUID) (ShippingAddress, bool, error) {
	var address ShippingAddress
	var sealedPhone []byte
	err := reader.Database.QueryRowContext(ctx, `SELECT a.id, a.account_id, a.recipient_name, a.phone, a.phone_sealed, a.line1, a.line2, a.postal_code, a.details, a.country_code,
		a.region_id, a.admin_area_id, a.city_id, COALESCE(r.name, a.free_text_state, ''), COALESCE(aa.name, ''), COALESCE(c.name, a.free_text_city, '')
		FROM `+reader.table("shipping_addresses")+` a
		LEFT JOIN `+reader.table("geo_regions")+` r ON r.id = a.region_id
		LEFT JOIN `+reader.table("geo_admin_areas")+` aa ON aa.id = a.admin_area_id
		LEFT JOIN `+reader.table("geo_cities")+` c ON c.id = a.city_id
		WHERE a.id = $1 AND a.account_id = $2`, addressId, accountId).
		Scan(&address.Id, &address.AccountId, &address.RecipientName, &address.Phone, &sealedPhone, &address.Line1, &address.Line2, &address.PostalCode, &address.Details, &address.CountryCode,
			&address.RegionId, &address.AdminAreaId, &address.CityId, &address.RegionName, &address.AdminAreaName, &address.CityName)
	if errors.Is(err, sql.ErrNoRows) {
		return ShippingAddress{}, false, nil
	}
	if err == nil {
		address.Phone, err = OpenAddressPhone(reader.addressPhoneKey(), address.Phone, sealedPhone)
	}
	return address, err == nil, err
}

func (reader Reader) FindRegionByCode(ctx context.Context, countryCode, regionCode string) (GeoRegion, bool, error) {
	var region GeoRegion
	err := reader.Database.QueryRowContext(ctx,
		"SELECT id, country_code, COALESCE(code, ''), name FROM "+reader.table("geo_regions")+" WHERE country_code = $1 AND UPPER(COALESCE(code, '')) = $2",
		strings.ToUpper(countryCode), strings.ToUpper(regionCode)).Scan(&region.Id, &region.CountryCode, &region.Code, &region.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return GeoRegion{}, false, nil
	}
	return region, err == nil, err
}

func (reader Reader) FindAdminAreaIdByName(ctx context.Context, regionId uuid.UUID, name string) (uuid.UUID, bool, error) {
	var identifier uuid.UUID
	err := reader.Database.QueryRowContext(ctx,
		"SELECT id FROM "+reader.table("geo_admin_areas")+" WHERE region_id = $1 AND LOWER(name) = LOWER($2)", regionId, name).Scan(&identifier)
	if errors.Is(err, sql.ErrNoRows) {
		return uuid.Nil, false, nil
	}
	return identifier, err == nil, err
}

func (reader Reader) RegionBelongsToCountry(ctx context.Context, regionId uuid.UUID, countryCode string) (bool, error) {
	var exists bool
	err := reader.Database.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM "+reader.table("geo_regions")+" WHERE id = $1 AND country_code = $2)", regionId, countryCode).Scan(&exists)
	return exists, err
}

func (reader Reader) AdminAreaBelongsToRegion(ctx context.Context, adminAreaId, regionId uuid.UUID) (bool, error) {
	var exists bool
	err := reader.Database.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM "+reader.table("geo_admin_areas")+" WHERE id = $1 AND region_id = $2)", adminAreaId, regionId).Scan(&exists)
	return exists, err
}

type PrivacyChoices struct {
	Analytics       bool
	Personalization bool
}

func (reader Reader) PrivacyChoicesOf(ctx context.Context, accountId uuid.UUID) (PrivacyChoices, bool, error) {
	var choices PrivacyChoices
	err := reader.Database.QueryRowContext(ctx, "SELECT analytics, personalization FROM "+reader.table("privacy_settings")+" WHERE account_id = $1", accountId).
		Scan(&choices.Analytics, &choices.Personalization)
	if errors.Is(err, sql.ErrNoRows) {
		return PrivacyChoices{}, false, nil
	}
	return choices, err == nil, err
}

func (reader Reader) DescribeRegions(ctx context.Context, regionIds []uuid.UUID) (map[uuid.UUID]GeoRegion, error) {
	result := map[uuid.UUID]GeoRegion{}
	if len(regionIds) == 0 {
		return result, nil
	}
	rows, err := reader.Database.QueryContext(ctx, "SELECT id, country_code, COALESCE(code, ''), name FROM "+reader.table("geo_regions")+" WHERE id = ANY($1)", regionIds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var region GeoRegion
		if err := rows.Scan(&region.Id, &region.CountryCode, &region.Code, &region.Name); err != nil {
			return nil, err
		}
		result[region.Id] = region
	}
	return result, rows.Err()
}

func (reader Reader) DescribeAdminAreas(ctx context.Context, adminAreaIds []uuid.UUID) (map[uuid.UUID]string, error) {
	result := map[uuid.UUID]string{}
	if len(adminAreaIds) == 0 {
		return result, nil
	}
	rows, err := reader.Database.QueryContext(ctx, "SELECT id, name FROM "+reader.table("geo_admin_areas")+" WHERE id = ANY($1)", adminAreaIds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var identifier uuid.UUID
		var name string
		if err := rows.Scan(&identifier, &name); err != nil {
			return nil, err
		}
		result[identifier] = name
	}
	return result, rows.Err()
}
