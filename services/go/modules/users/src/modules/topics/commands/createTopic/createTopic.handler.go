package createtopic

import (
	"context"
	"strings"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/modules/topics/services"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
)

type Command struct {
	Actor  types.StaffActor
	Name   string
	Reason string
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (map[string]any, error) {
	name := strings.TrimSpace(command.Name)
	slug := services.SlugFromName(name)
	if len(name) < 2 || len(name) > 40 || slug == "" {
		return nil, usersErrors.ValidationFailedFor("name", "must be 2 to 40 characters with letters or numbers")
	}
	reason, err := RequireReason(command.Reason)
	if err != nil {
		return nil, err
	}
	position, err := handler.Container.Client.Topic.Query().Count(ctx)
	if err != nil {
		return nil, err
	}
	row, err := handler.Container.Client.Topic.Create().SetID(slug).SetName(name).SetPosition(position).Save(ctx)
	if ent.IsConstraintError(err) {
		return nil, usersErrors.Conflict("SLUG_TAKEN", "Another topic already uses this name.")
	}
	if err != nil {
		return nil, err
	}
	view, err := services.BuildAdminTopicView(ctx, handler.Container.Client, row)
	if err != nil {
		return nil, err
	}
	err = usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
		Action: "catalog.topic_created", SubjectType: services.SubjectType, SubjectId: row.ID, SubjectLabel: row.Name, Reason: reason, After: view,
	})
	return map[string]any{"item": view}, err
}

func RequireReason(raw string) (string, error) {
	reason := strings.TrimSpace(raw)
	if len(reason) < 5 || len(reason) > 500 {
		return "", usersErrors.ValidationFailedFor("reason", "must be 5 to 500 characters")
	}
	return reason, nil
}
