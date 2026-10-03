package getauditfacets

import (
	"context"
	"slices"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent/auditevent"
	"zudomart/modules/admin/src/modules/auditLog/models"
)

type Handler struct {
	Container *container.Container
}

type Actor struct {
	Id   string `json:"id"`
	Name string `json:"name"`
}

type Result struct {
	Areas  []string `json:"areas"`
	Actors []Actor  `json:"actors"`
}

func (handler Handler) Execute(ctx context.Context) (Result, error) {
	actions, err := handler.Container.Client.AuditEvent.Query().Unique(true).Select(auditevent.FieldAction).Strings(ctx)
	if err != nil {
		return Result{}, err
	}
	result := Result{Areas: []string{}, Actors: []Actor{}}
	for _, action := range actions {
		if area := models.AuditAreaOfAction(action); !slices.Contains(result.Areas, area) {
			result.Areas = append(result.Areas, area)
		}
	}
	slices.Sort(result.Areas)
	var actors []struct {
		ActorId   string `json:"actor_id"`
		ActorName string `json:"actor_name"`
	}
	err = handler.Container.Client.AuditEvent.Query().GroupBy(auditevent.FieldActorID, auditevent.FieldActorName).Scan(ctx, &actors)
	for _, actor := range actors {
		result.Actors = append(result.Actors, Actor{Id: actor.ActorId, Name: actor.ActorName})
	}
	return result, err
}
