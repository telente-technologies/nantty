package updatetopic

import (
	"context"
	"strings"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	createtopic "zudomart/modules/users/src/modules/topics/commands/createTopic"
	"zudomart/modules/users/src/modules/topics/services"
	usersservices "zudomart/modules/users/src/services"
	"zudomart/modules/users/src/types"
)

type Command struct {
	Actor      types.StaffActor
	TopicId    string
	Name       *string
	Status     *string
	IsTrending *bool
	Reason     string
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (map[string]any, error) {
	reason, err := createtopic.RequireReason(command.Reason)
	if err != nil {
		return nil, err
	}
	before, err := handler.Container.Client.Topic.Get(ctx, command.TopicId)
	if ent.IsNotFound(err) {
		return nil, usersErrors.NotFound("That topic was not found.")
	}
	if err != nil {
		return nil, err
	}
	name, active, trending := before.Name, before.Active, before.IsTrending
	if command.Name != nil {
		name = strings.TrimSpace(*command.Name)
		if len(name) < 2 || len(name) > 40 || services.SlugFromName(name) == "" {
			return nil, usersErrors.ValidationFailedFor("name", "must be 2 to 40 characters with letters or numbers")
		}
	}
	if command.Status != nil {
		if *command.Status != "ACTIVE" && *command.Status != "HIDDEN" {
			return nil, usersErrors.ValidationFailedFor("status", "must be ACTIVE or HIDDEN")
		}
		active = *command.Status == "ACTIVE"
	}
	if command.IsTrending != nil {
		if *command.IsTrending && !active {
			return nil, usersErrors.Conflict("TOPIC_HIDDEN", "Show the topic again before marking it trending.")
		}
		trending = *command.IsTrending
	}
	if !active {
		trending = false
	}
	row, err := before.Update().SetName(name).SetActive(active).SetIsTrending(trending).Save(ctx)
	if err != nil {
		return nil, err
	}
	view, err := services.BuildAdminTopicView(ctx, handler.Container.Client, row)
	if err != nil {
		return nil, err
	}
	err = usersservices.RecordStaffAuditEntry(ctx, command.Actor, usersservices.StaffAuditEntry{
		Action: "catalog.topic_updated", SubjectType: services.SubjectType, SubjectId: row.ID, SubjectLabel: row.Name, Reason: reason,
		Before: map[string]any{"name": before.Name, "active": before.Active, "isTrending": before.IsTrending}, After: map[string]any{"name": name, "active": active, "isTrending": trending},
	})
	return map[string]any{"item": view}, err
}
