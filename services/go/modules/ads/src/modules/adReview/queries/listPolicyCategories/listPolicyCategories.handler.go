package listpolicycategories

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adpolicycategory"
	"nantty/modules/ads/src/modules/adReview/dtos"
	"nantty/modules/ads/src/modules/adReview/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, _ Query) ([]dtos.PolicyCategory, error) {
	rows, err := handler.Container.Client.AdPolicyCategory.Query().Order(adpolicycategory.ByName()).All(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]dtos.PolicyCategory, 0, len(rows))
	for _, row := range rows {
		items = append(items, services.PresentPolicyCategory(row))
	}
	return items, nil
}
