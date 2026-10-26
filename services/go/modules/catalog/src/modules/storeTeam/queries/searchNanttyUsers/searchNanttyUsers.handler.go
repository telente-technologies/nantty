package searchnanttyusers

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent/storemember"
	"nantty/modules/catalog/src/modules/storeTeam/dtos"
	"nantty/modules/catalog/src/modules/storeTeam/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.CandidateList, error) {
	excluded := []uuid.UUID{query.CallerId}
	if query.ExcludeTeam {
		members, err := handler.Container.Client.StoreMember.Query().Where(storemember.StoreID(query.Store.StoreId)).Select(storemember.FieldAccountID).Strings(ctx)
		if err != nil {
			return dtos.CandidateList{}, err
		}
		for _, raw := range members {
			if identifier, parseError := uuid.Parse(raw); parseError == nil {
				excluded = append(excluded, identifier)
			}
		}
	}
	profiles, err := handler.Container.Users.SearchActivePersonalProfiles(ctx, query.Text, excluded, 10)
	if err != nil {
		return dtos.CandidateList{}, err
	}
	return services.PresentCandidates(profiles), nil
}
