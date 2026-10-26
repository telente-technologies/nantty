package currency

import (
	"context"

	"nantty/modules/currency/src"
	"nantty/modules/currency/src/configs"
	"nantty/platform/events"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewCurrencyModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewCurrencyModule(ctx, dependencies)
}

func StartCurrencyModuleWithSettings(ctx context.Context, settings configs.CurrencySettings, publisher events.DomainEventPublisher, dependencies servicemodule.Dependencies) (*Module, error) {
	return src.StartCurrencyModuleWithSettings(ctx, settings, publisher, dependencies)
}
