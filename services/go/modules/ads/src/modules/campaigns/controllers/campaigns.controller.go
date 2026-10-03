package controllers

import (
	"net/http"
	"regexp"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

type CampaignsController struct{ Container *container.Container }

var datePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

type requestScope struct {
	user, account uuid.UUID
	from, to      string
	cursor        *uuid.UUID
	limit         int
}

func (controller CampaignsController) run(writer http.ResponseWriter, request *http.Request, work func(scope requestScope) error) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		user, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		account, err := utils.PathIdentifier(request, "accountId")
		if err != nil {
			return err
		}
		scope := requestScope{user: user, account: account, from: request.URL.Query().Get("from"), to: request.URL.Query().Get("to")}
		for name, value := range map[string]string{"from": scope.from, "to": scope.to} {
			if value != "" && !datePattern.MatchString(value) {
				return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: name, Message: "must be YYYY-MM-DD"}})
			}
		}
		if scope.limit, err = utils.PageLimit(request, 50); err != nil {
			return err
		}
		if scope.cursor, err = utils.DecodeCursor(request); err != nil {
			return err
		}
		return work(scope)
	})
}

func writePage[Item any](writer http.ResponseWriter, items []Item, next string, total int) {
	page := httpserver.NewCursorPage(items, next)
	total64 := int64(total)
	page.Total = &total64
	httpserver.WriteJsonResponse(writer, http.StatusOK, page)
}

func optionalId(request *http.Request, name string) (*uuid.UUID, error) {
	raw := request.URL.Query().Get(name)
	if raw == "" {
		return nil, nil
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: name, Message: "must be a valid id"}})
	}
	return &id, nil
}

func (controller CampaignsController) decode(writer http.ResponseWriter, request *http.Request, destination any) error {
	return utils.DecodeBody(writer, request, destination)
}
