package listbrands

import (
	"context"
	"strconv"
	"strings"

	"entgo.io/ent/dialect/sql"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/brand"
	brandservices "nantty/modules/catalog/src/modules/adminBrands/services"
	"nantty/modules/catalog/src/utils"
	"nantty/platform/httpserver"
)

type Query struct {
	Search   string
	Official string
	Country  string
	Cursor   string
	Limit    int
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[brandservices.BrandSummary], error) {
	empty := httpserver.CursorPage[brandservices.BrandSummary]{}
	offset := 0
	if parts, err := utils.DecodeCursor(query.Cursor, 1); err != nil {
		return empty, err
	} else if parts != nil {
		if offset, err = strconv.Atoi(parts[0]); err != nil || offset < 0 {
			return empty, httpserver.NewApiError(400, "INVALID_CURSOR", "The cursor is not valid.")
		}
	}
	request := handler.Container.Client.Brand.Query()
	if text := strings.TrimSpace(query.Search); text != "" {
		request = request.Where(brand.Or(brand.NameContainsFold(text), brand.SlugContainsFold(strings.TrimPrefix(text, "@"))))
	}
	if official := strings.ToUpper(query.Official); official != "" && official != "ALL" {
		request = request.Where(brand.OfficialStatus(official))
	}
	if country := strings.ToUpper(query.Country); country != "" {
		request = request.Where(brand.CountryCode(country))
	}
	rows, err := request.Order(func(selector *sql.Selector) {
		selector.OrderExpr(sql.Expr("CASE WHEN " + selector.C(brand.FieldOfficialStatus) + " = 'PENDING' THEN 0 ELSE 1 END"))
	}, ent.Asc(brand.FieldName), ent.Asc(brand.FieldID)).Offset(offset).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	nextCursor := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		nextCursor = utils.EncodeCursor(strconv.Itoa(offset + query.Limit))
	}
	summaries, err := brandservices.Summaries(ctx, handler.Container, rows)
	return httpserver.NewCursorPage(summaries, nextCursor), err
}
