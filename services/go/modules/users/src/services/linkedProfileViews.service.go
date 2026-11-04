package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/linkedprofile"
	"nantty/modules/users/src/generated/ent/profile"
	"nantty/modules/users/src/integrations"
	"nantty/modules/users/src/types"
)

type OwnedProfiles struct {
	Personal *ent.Profile
	Views    []types.ActingProfileView
}

func LinkedRowsByProfile(rows []*ent.LinkedProfile) map[uuid.UUID]*ent.LinkedProfile {
	indexed := make(map[uuid.UUID]*ent.LinkedProfile, len(rows))
	for _, row := range rows {
		indexed[row.ProfileID] = row
	}
	return indexed
}

func ApplyLinkedState(view types.ActingProfileView, row *ent.LinkedProfile, sellingEnabled bool) types.ActingProfileView {
	if row == nil {
		return view
	}
	view.Kind, view.Type = string(row.Kind), string(row.Kind)
	view.OnHold = view.OnHold || row.Status != linkedprofile.StatusActive
	view.ShowsMart = row.Kind == linkedprofile.KindStore || (row.Kind == linkedprofile.KindBrand && sellingEnabled)
	return view
}

func BrandActingProfileView(brand integrations.CatalogBrand, row *ent.LinkedProfile, activeId string) types.ActingProfileView {
	view := types.ActingProfileView{Id: brand.Id.String(), Name: brand.Name, Handle: brand.Slug, AvatarUrl: brand.LogoUrl, Active: brand.Id.String() == activeId}
	return ApplyLinkedState(view, row, brand.SellingEnabled)
}

func BuildLinkedActingProfileView(ctx context.Context, application *container.Container, row *ent.Profile, activeId string) (types.ActingProfileView, error) {
	view := types.BuildActingProfileView(row, activeId)
	if row.Kind == profile.KindPersonal {
		return view, nil
	}
	linked, err := application.Client.LinkedProfile.Query().Where(linkedprofile.ProfileID(row.ID), linkedprofile.KindIn(linkedprofile.KindStore, linkedprofile.KindBusiness, linkedprofile.KindBrand)).First(ctx)
	if ent.IsNotFound(err) {
		return view, nil
	}
	if err != nil {
		return view, err
	}
	return ApplyLinkedState(view, linked, false), nil
}

func ListOwnedActingProfiles(ctx context.Context, application *container.Container, accountId uuid.UUID, personal *ent.Profile, activeId string) ([]types.ActingProfileView, error) {
	views := []types.ActingProfileView{types.BuildActingProfileView(personal, activeId)}
	linked, err := LinkedProfilesOfAccount(ctx, application.Client, accountId)
	if err != nil || len(linked) == 0 {
		return views, err
	}
	byProfile := LinkedRowsByProfile(linked)
	profiles, err := ListActiveProfilesOfAccount(ctx, application, accountId)
	if err != nil {
		return nil, err
	}
	for _, row := range profiles {
		if entry, found := byProfile[row.ID]; found && row.Kind != profile.KindPersonal {
			views = append(views, ApplyLinkedState(types.BuildActingProfileView(row, activeId), entry, false))
		}
	}
	brandIds := make([]uuid.UUID, 0, 1)
	for _, row := range linked {
		if row.Kind == linkedprofile.KindBrand {
			brandIds = append(brandIds, row.ProfileID)
		}
	}
	if len(brandIds) == 0 || application.Catalog == nil {
		return views, nil
	}
	brands, err := application.Catalog.FindBrands(ctx, nil, brandIds)
	if err != nil {
		return nil, err
	}
	for _, brand := range brands {
		if brand.OwnerAccountId != nil && *brand.OwnerAccountId == accountId {
			views = append(views, BrandActingProfileView(brand, byProfile[brand.Id], activeId))
		}
	}
	return views, nil
}

func ApplyPublicProfileKind(ctx context.Context, client *ent.Client, view *types.UserView, accountId uuid.UUID) error {
	view.ProfileKind, view.ShowsMart = "personal", view.IsSeller
	rows, err := client.LinkedProfile.Query().Where(linkedprofile.AccountID(accountId), linkedprofile.StatusEQ(linkedprofile.StatusActive), linkedprofile.KindIn(linkedprofile.KindStore, linkedprofile.KindBusiness)).All(ctx)
	if err != nil || len(rows) == 0 {
		return err
	}
	view.ProfileKind = string(rows[0].Kind)
	view.ShowsMart = rows[0].Kind == linkedprofile.KindStore && rows[0].StoreID != nil
	return nil
}
