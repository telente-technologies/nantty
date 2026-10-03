package saveshippingrule

import (
	"context"

	"zudomart/modules/orders/src/container"
	"zudomart/modules/orders/src/services"
)

type Handler struct {
	Container *container.Container
}

type Result struct {
	Zone any `json:"zone"`
	Rule any `json:"rule"`
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	ruleId, err := services.SaveShippingRule(ctx, handler.Container, command.Store, command.RuleId, command.Input)
	if err != nil {
		return Result{}, err
	}
	profile, err := services.EnsureDefaultShippingProfile(ctx, handler.Container, command.Store)
	if err != nil {
		return Result{}, err
	}
	view, err := services.ShippingProfileViewOf(ctx, handler.Container, profile)
	if err != nil {
		return Result{}, err
	}
	for _, rule := range view.Rules {
		if rule.Id == ruleId.String() {
			for _, zone := range view.Zones {
				if zone.Id == rule.ZoneId {
					return Result{Zone: zone, Rule: rule}, nil
				}
			}
		}
	}
	return Result{}, nil
}
