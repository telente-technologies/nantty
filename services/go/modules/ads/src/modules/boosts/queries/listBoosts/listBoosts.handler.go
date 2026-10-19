package listboosts

import (
	"context"
	"strings"

	"entgo.io/ent/dialect/sql"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adboost"
	"zudomart/modules/ads/src/modules/boosts/dtos"
	"zudomart/modules/ads/src/modules/boosts/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

type Handler struct{ Container *container.Container }

func ParseStatuses(raw string) ([]adboost.Status, error) {
	statuses := []adboost.Status{}
	for _, value := range strings.Split(raw, ",") {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		status := adboost.Status(value)
		if adboost.StatusValidator(status) != nil {
			return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "status", Message: "Use pending_payment, in_review, active, paused, completed, rejected or cancelled."}})
		}
		statuses = append(statuses, status)
	}
	return statuses, nil
}

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.Boost, string, error) {
	request := handler.Container.Client.AdBoost.Query().Where(adboost.UserID(query.UserId))
	if len(query.Statuses) > 0 {
		request.Where(adboost.StatusIn(query.Statuses...))
	}
	if query.Cursor != nil {
		request.Where(adboost.IDLT(*query.Cursor))
	}
	rows, err := request.Order(adboost.ByID(sql.OrderDesc())).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		next = utils.EncodeCursor(rows[len(rows)-1].ID)
	}
	now := handler.Container.Now()
	presented, err := services.PresentBoosts(ctx, handler.Container.Client, rows, adsservices.DayKeyInTimezone(now, services.DefaultBoostTimezone), now)
	return presented, next, err
}
