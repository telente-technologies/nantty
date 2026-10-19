package listpromotabledestinations

import (
	"context"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/interfaces"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/creatives/dtos"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

const unavailableReason = "This is suspended or no longer active, so it can't be promoted."

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.PromotableDestination, error) {
	if query.Kind != "profile" && query.Kind != "store" {
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "type", Message: "Choose profile or store."}})
	}
	account, _, err := accountservices.LoadAccountForPermission(ctx, handler.Container, query.AccountId, query.UserId, adsservices.PermissionCampaignsView)
	if err != nil {
		return nil, err
	}
	found, err := handler.collect(ctx, account, query.Kind)
	if err != nil {
		return nil, err
	}
	listed := make([]dtos.PromotableDestination, 0, len(found))
	for _, destination := range found {
		listed = append(listed, present(destination))
	}
	return listed, nil
}

func (handler Handler) collect(ctx context.Context, account *ent.AdAccount, kind string) ([]interfaces.PromotedDestination, error) {
	directory := handler.Container.Promoted
	owned, err := directory.ListPromotableDestinations(ctx, kind, account.OwnerUserID.String())
	if err != nil {
		return nil, err
	}
	if kind != "store" || account.StoreID == "" || containsDestination(owned, account.StoreID) {
		return owned, nil
	}
	linked, err := directory.LookupDestinations(ctx, kind, []string{account.StoreID})
	if err != nil {
		return nil, err
	}
	if store, found := linked[account.StoreID]; found {
		owned = append([]interfaces.PromotedDestination{store}, owned...)
	}
	return owned, nil
}

func containsDestination(destinations []interfaces.PromotedDestination, id string) bool {
	for _, destination := range destinations {
		if destination.Id == id {
			return true
		}
	}
	return false
}

func present(destination interfaces.PromotedDestination) dtos.PromotableDestination {
	presented := dtos.PromotableDestination{PromotedDestination: destination, Eligible: destination.Available}
	if !destination.Available {
		reason := unavailableReason
		presented.IneligibleReason = &reason
	}
	return presented
}
