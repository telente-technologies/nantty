package listadmintopics

import (
	"context"
	"strings"

	"entgo.io/ent/dialect/sql"

	"nantty/modules/users/src/container"
	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/topic"
	"nantty/modules/users/src/modules/topics/services"
	"nantty/platform/identityports"
)

type Query struct {
	Search string
	Status string
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) List(ctx context.Context, query Query) (map[string]any, error) {
	topics := handler.Container.Client.Topic.Query().Order(ent.Asc(topic.FieldPosition), ent.Asc(topic.FieldID))
	if search := strings.TrimSpace(query.Search); search != "" {
		topics = topics.Where(topic.Or(topic.NameContainsFold(search), func(selector *sql.Selector) {
			selector.Where(sql.ContainsFold(selector.C(topic.FieldID), search))
		}))
	}
	switch query.Status {
	case "":
	case "ACTIVE", "HIDDEN":
		topics = topics.Where(topic.Active(query.Status == "ACTIVE"))
	default:
		return nil, usersErrors.ValidationFailedFor("status", "must be ACTIVE or HIDDEN")
	}
	rows, err := topics.All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]services.AdminTopicView, 0, len(rows))
	for _, row := range rows {
		view, err := services.BuildAdminTopicView(ctx, handler.Container.Client, row)
		if err != nil {
			return nil, err
		}
		views = append(views, view)
	}
	return map[string]any{"items": views}, nil
}

func (handler Handler) Get(ctx context.Context, topicId string) (map[string]any, error) {
	row, err := handler.Container.Client.Topic.Get(ctx, topicId)
	if ent.IsNotFound(err) {
		return nil, usersErrors.NotFound("That topic was not found.")
	}
	if err != nil {
		return nil, err
	}
	view, err := services.BuildAdminTopicView(ctx, handler.Container.Client, row)
	if err != nil {
		return nil, err
	}
	history := []any{}
	if reader, portErr := identityports.Default.AuditHistoryReader(); portErr == nil {
		entries, err := reader.ListAuditHistoryForSubject(ctx, services.SubjectType, row.ID, 50)
		if err != nil {
			return nil, err
		}
		for _, entry := range entries {
			history = append(history, entry)
		}
	}
	return map[string]any{"item": view, "history": history}, nil
}
