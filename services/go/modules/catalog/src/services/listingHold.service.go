package services

import (
	"context"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
)

func AssertStoreAcceptsNewListings(ctx context.Context, deployed *container.Container, row *ent.Store) error {
	kind, profileId := "store", row.BusinessProfileID
	if row.Channel == enums.ChannelBrand {
		if row.BrandID == nil {
			return catalogerrors.BrandSellingOff
		}
		owner, err := deployed.Client.Brand.Get(ctx, *row.BrandID)
		if err != nil {
			return err
		}
		if !owner.SellingEnabled || row.Status == enums.StorePaused {
			return catalogerrors.BrandSellingOff
		}
		kind, profileId = "brand", owner.ID
	}
	status, err := deployed.LinkedProfiles.StatusOf(ctx, row.OwnerAccountID, kind, profileId)
	if err != nil {
		return err
	}
	if status == "held" || status == "retired" {
		return catalogerrors.ProfileOnHold
	}
	return nil
}
