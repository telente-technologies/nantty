package getbrandsearchsource

import (
	"context"
	"net/http"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/modules/internalSources/dtos"
	"zudomart/modules/catalog/src/modules/internalSources/services"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.BrandSearchSource, error) {
	row, err := handler.Container.Client.Brand.Get(ctx, query.BrandId)
	if ent.IsNotFound(err) {
		return dtos.BrandSearchSource{}, httpserver.NewApiError(http.StatusNotFound, "BRAND_NOT_FOUND", "That brand could not be found.")
	}
	if err != nil {
		return dtos.BrandSearchSource{}, err
	}
	source := dtos.BrandSearchSource{BrandId: row.ID.String(), Name: row.Name, Handle: row.Slug, LogoUrl: row.LogoURL, Verified: row.Official, Active: row.Active, CreatedAt: services.Timestamp(row.CreatedAt)}
	if row.OwnerProfileID != nil {
		owner := row.OwnerProfileID.String()
		source.OwnerAccountId = &owner
	}
	if row.Official {
		source.Verification = map[string]any{"kind": "official", "verified": true}
	}
	return source, nil
}
