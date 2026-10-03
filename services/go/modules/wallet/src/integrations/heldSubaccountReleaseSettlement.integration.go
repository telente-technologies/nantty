package integrations

import (
	"context"

	"zudomart/modules/wallet/src/interfaces"
)

type HeldSubaccountReleaseSettlement struct{}

func (HeldSubaccountReleaseSettlement) Name() string { return "heldSubaccountRelease" }

func (HeldSubaccountReleaseSettlement) SettleSellerPayout(context.Context, interfaces.SellerPayoutInstruction) (string, error) {
	return "", interfaces.ErrSettlementAdapterNotImplemented
}
