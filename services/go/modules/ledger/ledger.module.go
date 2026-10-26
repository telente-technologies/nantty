package ledger

import (
	"context"

	"nantty/modules/ledger/src"
	"nantty/platform/servicemodule"
)

type Module = src.Module

func NewLedgerModule(ctx context.Context, dependencies servicemodule.Dependencies) (servicemodule.Module, error) {
	return src.NewLedgerModule(ctx, dependencies)
}
