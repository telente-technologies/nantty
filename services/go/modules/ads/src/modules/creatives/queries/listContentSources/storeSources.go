package listcontentsources

import (
	"context"
	"strings"

	listpromotabledestinations "zudomart/modules/ads/src/modules/creatives/queries/listPromotableDestinations"
)

func (handler Handler) listStores(ctx context.Context, query Query) ([]map[string]any, string, error) {
	stores, err := (listpromotabledestinations.Handler{Container: handler.Container}).Execute(ctx, listpromotabledestinations.Query{AccountId: query.AccountId, UserId: query.UserId, Kind: "store"})
	if err != nil {
		return nil, "", err
	}
	search := strings.ToLower(strings.TrimSpace(query.Search))
	items := []map[string]any{}
	for _, store := range stores {
		if search != "" && !strings.Contains(strings.ToLower(store.Name), search) {
			continue
		}
		media := []map[string]any{}
		if store.AvatarUrl != nil {
			media = append(media, map[string]any{"id": "store-logo-" + store.Id, "kind": "image", "url": *store.AvatarUrl, "posterUrl": nil, "width": 0, "height": 0, "durationSeconds": nil})
		}
		items = append(items, map[string]any{
			"id": store.Id, "type": "store", "title": store.Name, "text": "", "media": media, "createdAt": "",
			"engagement": map[string]int{"likes": 0, "comments": 0, "views": 0}, "product": nil, "eligible": store.Eligible, "ineligibleReason": store.IneligibleReason,
		})
	}
	return items, "", nil
}
