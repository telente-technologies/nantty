package ledger

import (
	"context"

	"zudomart/platform/servicemodule"
)

func NewLedgerModule(context.Context, servicemodule.Dependencies) (servicemodule.Module, error) {
	return servicemodule.RoutelessModule{ModuleName: "ledger"}, nil
}
