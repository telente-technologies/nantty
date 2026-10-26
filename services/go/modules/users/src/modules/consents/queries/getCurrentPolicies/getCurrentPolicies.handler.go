package getcurrentpolicies

import (
	"context"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/modules/consents/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, _ Query) ([]*ent.PolicyVersion, error) {
	current, err := services.CurrentPolicyVersions(ctx, handler.Container.Client, handler.Container.Now())
	if err != nil {
		return nil, err
	}
	ordered := make([]*ent.PolicyVersion, 0, len(current))
	for _, kind := range services.PolicyKinds {
		if row := current[kind]; row != nil {
			ordered = append(ordered, row)
		}
	}
	return ordered, nil
}
