package updatestorefront

import (
	"context"
	"sort"
	"strings"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	replacefeatured "zudomart/modules/catalog/src/modules/featuredProducts/commands/replaceFeaturedProducts"
	featureddtos "zudomart/modules/catalog/src/modules/featuredProducts/dtos"
	"zudomart/modules/catalog/src/modules/storeSettings/dtos"
	"zudomart/modules/catalog/src/modules/storeSettings/queries/getStorefront"
	"zudomart/modules/catalog/src/modules/storeSettings/services"
	catalogservices "zudomart/modules/catalog/src/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (dtos.StorefrontView, error) {
	request := command.Request
	changed := []string{}
	if request.FeaturedProductIds != nil {
		items := make([]featureddtos.FeaturedProductInput, 0, len(*request.FeaturedProductIds))
		for _, productId := range *request.FeaturedProductIds {
			items = append(items, featureddtos.FeaturedProductInput{ProductId: productId, Placement: "storefront"})
		}
		replace := replacefeatured.Handler{Container: handler.Container}
		if _, err := replace.Execute(ctx, replacefeatured.Command{Store: command.Store, Request: featureddtos.ReplaceFeaturedProductsRequest{Items: items}}); err != nil {
			return dtos.StorefrontView{}, err
		}
		changed = append(changed, "featuredProducts")
	}
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.Store.UpdateOneID(command.Store.StoreId)
		changed = append(changed, handler.applyStorefrontFields(update, request)...)
		if len(changed) == 0 {
			return nil
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		sort.Strings(changed)
		summary := "Updated storefront: " + strings.Join(changed, ", ")
		if err := catalogservices.RecordStoreAuditInTransaction(ctx, tx, catalogservices.AuditRecordFor(command.Store, command.Actor, "storefront.updated", "store", command.Store.StoreId.String(), summary)); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.updated", command.Store.StoreId.String(), handler.Container.Now(), map[string]any{"storeId": command.Store.StoreId, "changed": changed})
	})
	if err != nil {
		return dtos.StorefrontView{}, err
	}
	return getstorefront.Handler{Container: handler.Container}.Execute(ctx, getstorefront.Query{Store: command.Store})
}

func (handler Handler) applyStorefrontFields(update *ent.StoreUpdateOne, request dtos.UpdateStorefrontRequest) []string {
	changed := []string{}
	if request.Name != nil {
		update.SetName(strings.TrimSpace(*request.Name))
		changed = append(changed, "name")
	}
	if request.Tagline != nil {
		update.SetTagline(strings.TrimSpace(*request.Tagline))
		changed = append(changed, "tagline")
	}
	if request.Description != nil {
		update.SetDescription(*request.Description)
		changed = append(changed, "description")
	}
	if request.LogoMediaId.Present {
		if request.LogoMediaId.Value == nil {
			update.ClearLogoURL()
		} else {
			update.SetLogoURL(services.MediaUrlFor(handler.Container, *request.LogoMediaId.Value))
		}
		changed = append(changed, "logo")
	}
	if request.CoverMediaId.Present {
		if request.CoverMediaId.Value == nil {
			update.ClearBannerURL()
		} else {
			update.SetBannerURL(services.MediaUrlFor(handler.Container, *request.CoverMediaId.Value))
		}
		changed = append(changed, "cover")
	}
	if request.Policies != nil {
		update.SetPolicies(*request.Policies)
		changed = append(changed, "policies")
	}
	if request.OpeningHours != nil {
		update.SetOpeningHours(*request.OpeningHours)
		changed = append(changed, "openingHours")
	}
	if request.SocialLinks != nil {
		links := map[string]string{}
		for network, link := range *request.SocialLinks {
			if link != nil && strings.TrimSpace(*link) != "" {
				links[network] = strings.TrimSpace(*link)
			}
		}
		update.SetSocialLinks(links)
		changed = append(changed, "socialLinks")
	}
	return changed
}
