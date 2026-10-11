package createbrandstorefront

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/brand"
	"zudomart/modules/catalog/src/generated/ent/store"
	"zudomart/modules/catalog/src/services"
	"zudomart/platform/commerceports"
	"zudomart/platform/httpserver"
)

type Command struct {
	AccountId   uuid.UUID
	BrandId     uuid.UUID
	CountryCode *string
}

type Result struct {
	StoreId uuid.UUID `json:"id"`
	Slug    string    `json:"slug"`
	Name    string    `json:"name"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	owned, err := handler.Container.Client.Brand.Query().Where(brand.ID(command.BrandId), brand.Active(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return Result{}, catalogerrors.BrandNotFound
	}
	if err != nil {
		return Result{}, err
	}
	if owned.OwnerAccountID == nil || *owned.OwnerAccountID != command.AccountId {
		return Result{}, catalogerrors.BrandNotOwned
	}
	if !owned.SellingEnabled {
		return Result{}, catalogerrors.BrandSellingOff
	}
	if status, err := handler.Container.LinkedProfiles.StatusOf(ctx, command.AccountId, "brand", owned.ID); err != nil || status == "held" || status == "retired" {
		return Result{}, firstError(err, catalogerrors.ProfileOnHold)
	}
	country, err := handler.country(ctx, command)
	if err != nil {
		return Result{}, err
	}
	currency, supported := services.CurrencyForCountry(country)
	if !supported {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "countryCode", Message: "stores are not available in this country yet"}})
	}
	slug, err := handler.slugFor(ctx, owned.Slug)
	if err != nil {
		return Result{}, err
	}
	var created *ent.Store
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var createError error
		created, createError = tx.Store.Create().SetOwnerAccountID(command.AccountId).SetBusinessProfileID(owned.ID).SetBrandID(owned.ID).SetChannel(enums.ChannelBrand).
			SetName(owned.Name).SetSlug(slug).SetDescription(owned.Description).SetCountryCode(country).SetCurrency(currency).Save(ctx)
		if createError != nil {
			return createError
		}
		if createError = tx.StoreMember.Create().SetStoreID(created.ID).SetAccountID(command.AccountId).SetRole("owner").Exec(ctx); createError != nil {
			return createError
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.created", created.ID.String(), handler.Container.Now(), map[string]any{
			"storeId": created.ID, "ownerAccountId": command.AccountId, "brandId": owned.ID, "channel": enums.ChannelBrand, "currency": currency, "countryCode": country,
		})
	})
	if ent.IsConstraintError(err) {
		return Result{}, catalogerrors.BrandStorefrontExists
	}
	if err != nil {
		return Result{}, err
	}
	if inventory, portError := commerceports.Default.InventoryStock(); portError == nil {
		if _, err := inventory.EnsureDefaultLocation(ctx, created.ID, country); err != nil {
			return Result{}, err
		}
	}
	return Result{StoreId: created.ID, Slug: created.Slug, Name: created.Name}, nil
}

func (handler Handler) country(ctx context.Context, command Command) (string, error) {
	if command.CountryCode != nil {
		return strings.ToUpper(*command.CountryCode), nil
	}
	country, err := handler.Container.Users.PersonalProfileCountry(ctx, command.AccountId)
	return strings.ToUpper(country), err
}

func (handler Handler) slugFor(ctx context.Context, base string) (string, error) {
	for _, candidate := range []string{base, base + "-store", base + "-shop"} {
		taken, err := handler.Container.Client.Store.Query().Where(store.Slug(candidate)).Exist(ctx)
		if err != nil || !taken {
			return candidate, err
		}
	}
	return "", catalogerrors.StoreSlugTaken
}

func firstError(primary, fallback error) error {
	if primary != nil {
		return primary
	}
	return fallback
}
