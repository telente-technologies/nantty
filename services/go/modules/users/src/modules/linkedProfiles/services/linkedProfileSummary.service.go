package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/linkedprofile"
	"nantty/modules/users/src/generated/ent/profile"
	usersservices "nantty/modules/users/src/services"
)

type LinkedProfileItem struct {
	Kind          string  `json:"kind"`
	ProfileId     string  `json:"profileId"`
	StoreId       *string `json:"storeId"`
	Status        string  `json:"status"`
	HoldReason    *string `json:"holdReason"`
	Name          string  `json:"name"`
	Handle        string  `json:"handle"`
	ShowsMart     bool    `json:"showsMart"`
	OwnsStore     bool    `json:"ownsStore"`
	PremiumNeeded bool    `json:"premiumNeeded"`
}

type BusinessProfileAllowance struct {
	Count         int  `json:"count"`
	Limit         int  `json:"limit"`
	PremiumLimit  int  `json:"premiumLimit"`
	Premium       bool `json:"premium"`
	PremiumNeeded bool `json:"premiumNeeded"`
	StoreUsed     bool `json:"storeUsed"`
}

type CreateOptions struct {
	Store    bool `json:"store"`
	Business bool `json:"business"`
	Brand    bool `json:"brand"`
}

type Summary struct {
	AccountId      string                   `json:"accountId"`
	Items          []LinkedProfileItem      `json:"items"`
	CanCreate      CreateOptions            `json:"canCreate"`
	ChoiceRequired bool                     `json:"choiceRequired"`
	Allowance      BusinessProfileAllowance `json:"businessProfiles"`
}

func BuildSummary(ctx context.Context, deployed *container.Container, accountId uuid.UUID) (Summary, error) {
	rows, err := deployed.Client.LinkedProfile.Query().Where(linkedprofile.AccountID(accountId)).Order(ent.Asc(linkedprofile.FieldCreatedAt)).All(ctx)
	if err != nil {
		return Summary{}, err
	}
	names, err := namesFor(ctx, deployed, rows)
	if err != nil {
		return Summary{}, err
	}
	premium, err := usersservices.AccountHasPremium(ctx, deployed.Client, accountId, deployed.Now())
	if err != nil {
		return Summary{}, err
	}
	summary := Summary{AccountId: accountId.String(), Items: make([]LinkedProfileItem, 0, len(rows)), CanCreate: CreateOptions{Store: true, Business: true, Brand: true}}
	standard := usersservices.StandardSlotsOf(rows)
	for _, row := range rows {
		item := LinkedProfileItem{Kind: string(row.Kind), ProfileId: row.ProfileID.String(), Status: string(row.Status), HoldReason: row.HoldReason, Name: names[row.ProfileID].name, Handle: names[row.ProfileID].handle}
		item.ShowsMart = row.Status == linkedprofile.StatusActive && (row.Kind == linkedprofile.KindStore || (row.Kind == linkedprofile.KindBrand && names[row.ProfileID].selling))
		if row.StoreID != nil {
			storeId := row.StoreID.String()
			item.StoreId = &storeId
		}
		item.OwnsStore = row.Status == linkedprofile.StatusActive && usersservices.OwnsStore(row)
		item.PremiumNeeded = row.Status == linkedprofile.StatusActive && !premium && !standard[row.ProfileID]
		summary.Items = append(summary.Items, item)
		summary.ChoiceRequired = summary.ChoiceRequired || row.Status == linkedprofile.StatusHeld
		if row.Status != linkedprofile.StatusActive {
			continue
		}
		summary.Allowance.Count++
		summary.Allowance.StoreUsed = summary.Allowance.StoreUsed || item.OwnsStore
		summary.Allowance.PremiumNeeded = summary.Allowance.PremiumNeeded || item.PremiumNeeded
		if premium {
			continue
		}
		if row.Kind == linkedprofile.KindBrand {
			summary.CanCreate.Brand = false
		} else {
			summary.CanCreate.Store, summary.CanCreate.Business = false, false
		}
	}
	summary.Allowance.Premium, summary.Allowance.PremiumLimit = premium, usersservices.PremiumBusinessProfileLimit
	summary.Allowance.Limit = usersservices.StandardBusinessProfileLimit
	if premium {
		summary.Allowance.Limit = usersservices.PremiumBusinessProfileLimit
		full := summary.Allowance.Count >= usersservices.PremiumBusinessProfileLimit
		summary.CanCreate = CreateOptions{Store: !full && !summary.Allowance.StoreUsed && !summary.ChoiceRequired, Business: !full, Brand: !full}
	}
	if summary.Allowance.PremiumNeeded {
		summary.CanCreate = CreateOptions{}
	}
	return summary, nil
}

type displayName struct {
	name, handle string
	selling      bool
}

func namesFor(ctx context.Context, deployed *container.Container, rows []*ent.LinkedProfile) (map[uuid.UUID]displayName, error) {
	names := map[uuid.UUID]displayName{}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.ProfileID)
	}
	profiles, err := deployed.Client.Profile.Query().Where(profile.IDIn(identifiers...)).All(ctx)
	if err != nil {
		return nil, err
	}
	for _, row := range profiles {
		names[row.ID] = displayName{name: row.DisplayName, handle: row.Handle}
	}
	if deployed.Catalog == nil {
		return names, nil
	}
	brands, err := deployed.Catalog.FindBrands(ctx, nil, identifiers)
	if err != nil {
		return nil, err
	}
	for _, brand := range brands {
		names[brand.Id] = displayName{name: brand.Name, handle: brand.Slug, selling: brand.SellingEnabled}
	}
	return names, nil
}
