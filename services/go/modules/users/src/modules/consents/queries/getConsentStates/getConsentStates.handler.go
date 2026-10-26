package getconsentstates

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/modules/consents/models"
	"nantty/modules/users/src/modules/consents/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (Result, error) {
	states, err := services.ReadConsentStates(ctx, handler.Container.Client, query.Subject)
	if err != nil {
		return Result{}, err
	}
	current, err := services.CurrentPolicyVersions(ctx, handler.Container.Client, handler.Container.Now())
	if err != nil {
		return Result{}, err
	}
	version := ""
	if privacy := current[models.PolicyPrivacy]; privacy != nil {
		version = privacy.Version
	}
	return Result{States: states, PolicyVersion: version, NeedsRenewal: services.NeedsRenewal(states, version)}, nil
}
