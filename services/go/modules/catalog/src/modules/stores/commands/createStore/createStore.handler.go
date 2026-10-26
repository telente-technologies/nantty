package createstore

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/databases/schema"
	"nantty/modules/catalog/src/enums"
	catalogerrors "nantty/modules/catalog/src/errors"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/store"
	"nantty/modules/catalog/src/interfaces"
	"nantty/modules/catalog/src/modules/stores/dtos"
	"nantty/modules/catalog/src/services"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

type Result struct {
	StoreId uuid.UUID `json:"id"`
	Slug    string    `json:"slug"`
	Name    string    `json:"name"`
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	request := command.Request
	profile, found, err := handler.Container.Users.FindBusinessProfile(ctx, uuid.MustParse(request.BusinessProfileId))
	if err != nil {
		return Result{}, err
	}
	if !found || !profile.Active || profile.AccountId != command.AccountId {
		return Result{}, catalogerrors.BusinessProfileInvalid
	}
	country := strings.ToUpper(profile.CountryCode)
	if request.CountryCode != nil {
		country = strings.ToUpper(*request.CountryCode)
	}
	currency, supported := services.CurrencyForCountry(country)
	if !supported {
		return Result{}, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "countryCode", Message: "stores are not available in this country yet"}})
	}
	slug, err := handler.chooseSlug(ctx, request)
	if err != nil {
		return Result{}, err
	}
	if err := handler.refuseSecondStore(ctx, command.AccountId); err != nil {
		return Result{}, err
	}
	storeId := schema.NewTimeOrderedUuid()
	claim := interfaces.LinkedClaim{Kind: "store", ProfileId: profile.ProfileId, StoreId: &storeId}
	if err := handler.Container.LinkedProfiles.Claim(ctx, command.AccountId, claim); err != nil {
		return Result{}, err
	}
	var created *ent.Store
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		var createError error
		if _, createError = tx.ExecContext(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 13))", "store-owner:"+command.AccountId.String()); createError != nil {
			return createError
		}
		if owned, lookupError := tx.Store.Query().Where(store.OwnerAccountID(command.AccountId), store.Channel(enums.ChannelStore), store.StatusNEQ(enums.StoreClosed)).Exist(ctx); lookupError != nil || owned {
			return firstError(lookupError, catalogerrors.StoreLimitOne)
		}
		created, createError = tx.Store.Create().SetID(storeId).SetOwnerAccountID(command.AccountId).SetBusinessProfileID(profile.ProfileId).SetName(strings.TrimSpace(request.Name)).
			SetSlug(slug).SetDescription(request.Description).SetCountryCode(country).SetCurrency(currency).Save(ctx)
		if createError != nil {
			return createError
		}
		if createError = tx.StoreMember.Create().SetStoreID(created.ID).SetAccountID(command.AccountId).SetRole("owner").Exec(ctx); createError != nil {
			return createError
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.created", created.ID.String(), handler.Container.Now(), map[string]any{
			"storeId": created.ID, "ownerAccountId": command.AccountId, "businessProfileId": profile.ProfileId, "currency": currency, "countryCode": country,
		})
	})
	if err != nil {
		if releaseErr := handler.Container.LinkedProfiles.Release(ctx, command.AccountId, claim); releaseErr != nil {
			handler.Container.Logger.Error("release linked store claim", slog.Any("error", releaseErr))
		}
	}
	if ent.IsConstraintError(err) {
		return Result{}, catalogerrors.StoreAlreadyExists
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

func (handler Handler) chooseSlug(ctx context.Context, request dtos.CreateStoreRequest) (string, error) {
	if request.Slug != nil {
		taken, err := services.StoreExistsWithSlug(ctx, handler.Container, *request.Slug)
		if err != nil || taken {
			return "", firstError(err, catalogerrors.StoreSlugTaken)
		}
		return *request.Slug, nil
	}
	base := services.Slugify(request.Name)
	candidate := base
	for attempt := 0; attempt < 5; attempt++ {
		taken, err := services.StoreExistsWithSlug(ctx, handler.Container, candidate)
		if err != nil {
			return "", err
		}
		if !taken {
			return candidate, nil
		}
		suffix := make([]byte, 2)
		_, _ = rand.Read(suffix)
		candidate = base + "-" + hex.EncodeToString(suffix)
	}
	return "", catalogerrors.StoreSlugTaken
}

func (handler Handler) refuseSecondStore(ctx context.Context, accountId uuid.UUID) error {
	owned, err := handler.Container.Client.Store.Query().Where(store.OwnerAccountID(accountId), store.Channel(enums.ChannelStore), store.StatusNEQ(enums.StoreClosed)).Exist(ctx)
	if err != nil {
		return err
	}
	if owned {
		return catalogerrors.StoreLimitOne
	}
	return nil
}

func firstError(primary, fallback error) error {
	if primary != nil {
		return primary
	}
	return fallback
}
