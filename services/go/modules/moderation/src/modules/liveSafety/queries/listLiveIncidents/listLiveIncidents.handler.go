package listliveincidents

import (
	"context"
	"slices"
	"strings"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/livesafetyincident"
	"nantty/modules/moderation/src/generated/ent/livesafetysignal"
	"nantty/modules/moderation/src/generated/ent/predicate"
	"nantty/modules/moderation/src/modules/liveSafety/services"
)

const pageSize = 25

type Query struct {
	Status   string
	Priority string
	Search   string
	Page     int
}

type Result struct {
	Items      []services.IncidentSummary `json:"data"`
	NextCursor *string                    `json:"nextCursor"`
	Page       int                        `json:"page"`
	PageSize   int                        `json:"pageSize"`
	Total      int                        `json:"total"`
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	var predicates []predicate.LiveSafetyIncident
	switch status := strings.ToLower(query.Status); status {
	case "", "open":
		predicates = append(predicates, livesafetyincident.StatusEQ(livesafetyincident.StatusOpen))
	case "closed":
		predicates = append(predicates, livesafetyincident.StatusEQ(livesafetyincident.StatusClosed))
	}
	if priority := strings.ToLower(query.Priority); priority != "" {
		predicates = append(predicates, livesafetyincident.PriorityEQ(livesafetyincident.Priority(priority)))
	}
	if search := strings.TrimSpace(query.Search); search != "" {
		predicates = append(predicates, livesafetyincident.LiveIDContainsFold(search))
	}
	rows, err := handler.Container.Client.LiveSafetyIncident.Query().Where(predicates...).Order(ent.Asc(livesafetyincident.FieldSLADueAt)).Limit(1000).All(ctx)
	if err != nil {
		return Result{}, err
	}
	slices.SortStableFunc(rows, CompareIncidentsUrgentFirst)
	page := max(query.Page, 1)
	start := min((page-1)*pageSize, len(rows))
	end := min(start+pageSize, len(rows))
	visible := rows[start:end]
	hosts := services.HostSummaries(ctx, handler.Container, visible)
	items := make([]services.IncidentSummary, 0, len(visible))
	for _, incident := range visible {
		items = append(items, services.PresentIncidentSummary(incident, hosts, handler.latestFrameUrl(ctx, incident)))
	}
	return Result{Items: items, Page: page, PageSize: pageSize, Total: len(rows)}, nil
}

func (handler Handler) latestFrameUrl(ctx context.Context, incident *ent.LiveSafetyIncident) *string {
	if incident.HashMatch {
		return nil
	}
	latest, err := handler.Container.Client.LiveSafetySignal.Query().Where(livesafetysignal.IncidentID(incident.ID), livesafetysignal.KindEQ(livesafetysignal.KindFrame), livesafetysignal.HashMatch(false)).
		Order(ent.Desc(livesafetysignal.FieldCreatedAt)).First(ctx)
	if err != nil {
		return nil
	}
	return services.PresignFrame(ctx, handler.Container, latest.FrameRef)
}

func CompareIncidentsUrgentFirst(left, right *ent.LiveSafetyIncident) int {
	if left.Status != right.Status {
		if left.Status == livesafetyincident.StatusOpen {
			return -1
		}
		return 1
	}
	if byPriority := services.PriorityRank(string(left.Priority)) - services.PriorityRank(string(right.Priority)); byPriority != 0 {
		return byPriority
	}
	if left.HoldActive != right.HoldActive {
		if left.HoldActive {
			return -1
		}
		return 1
	}
	return left.SLADueAt.Compare(right.SLADueAt)
}
