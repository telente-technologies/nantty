package listsettingversions

import (
	"context"
	"strconv"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/platformsettingrevision"
	"zudomart/modules/admin/src/modules/platformSettings/models"
	"zudomart/modules/admin/src/modules/platformSettings/services"
)

const pageSize = 50

type Page struct {
	Data       []models.PlatformSettingView `json:"data"`
	NextCursor *string                      `json:"nextCursor"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Page, error) {
	if _, known := services.PlatformSettingDefinitions[query.Key]; !known {
		return Page{}, adminerrors.SettingNotFound
	}
	request := handler.Container.Client.PlatformSettingRevision.Query().Where(platformsettingrevision.Key(query.Key))
	if query.Cursor != "" {
		before, err := strconv.Atoi(query.Cursor)
		if err != nil || before < 1 {
			return Page{}, adminerrors.ValidationFailedFor("cursor", "is not a valid cursor")
		}
		request = request.Where(platformsettingrevision.VersionLT(before))
	}
	rows, err := request.Order(ent.Desc(platformsettingrevision.FieldVersion)).Limit(pageSize + 1).All(ctx)
	if err != nil {
		return Page{}, err
	}
	var next *string
	if len(rows) > pageSize {
		rows = rows[:pageSize]
		cursor := strconv.Itoa(rows[pageSize-1].Version)
		next = &cursor
	}
	views, err := services.BuildRevisionViews(ctx, handler.Container.Client, rows)
	return Page{Data: views, NextCursor: next}, err
}
