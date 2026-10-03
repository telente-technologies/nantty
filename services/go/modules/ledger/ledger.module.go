package ledger

import (
	"context"

	"zudomart/modules/ledger/src"
	"zudomart/platform/servicemodule"
)

type Module = src.Module

func NewLedgerModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewLedgerModule(ctx, dependencies)
}
