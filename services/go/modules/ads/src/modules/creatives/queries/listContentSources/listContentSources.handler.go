package listcontentsources

import (
	"context"
	"slices"
	"strings"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/interfaces"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

var sourceTypes = []string{"", "post", "clip", "product", "live", "store"}

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]map[string]any, string, error) {
	deployed := handler.Container
	if !slices.Contains(sourceTypes, query.Type) {
		return nil, "", httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "type", Message: "Choose post, clip, product, live or store."}})
	}
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionCampaignsView)
	if err != nil {
		return nil, "", err
	}
	items, next, err := deployed.ContentSources.ListContentSources(ctx, interfaces.ContentSourceQuery{
		OwnerUserId: account.OwnerUserID.String(), StoreId: account.StoreID, Type: query.Type, Search: strings.TrimSpace(query.Search), Cursor: query.Cursor, Limit: query.Limit,
	})
	if err != nil {
		return nil, "", err
	}
	for _, item := range items {
		if _, marked := item["eligible"].(bool); !marked {
			item["eligible"], item["ineligibleReason"] = false, "This item cannot be promoted right now."
		}
	}
	return items, next, nil
}
