package services

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"nantty/modules/creators/src/modules/liveMoney/models"
)

func TestResolveTipCreatorAcceptsOnlyUUIDProfileTargets(t *testing.T) {
	money := CreatorMoney{}
	creatorID := uuid.NewString()
	got, err := money.resolveTipCreator(context.Background(), TipRequest{TargetType: "profile", TargetId: creatorID})
	if err != nil || got != creatorID {
		t.Fatalf("valid profile target = %q, %v; want %q, nil", got, err, creatorID)
	}
	if _, err := money.resolveTipCreator(context.Background(), TipRequest{TargetType: "profile", TargetId: "not-a-uuid"}); err != ErrTipTargetNotFound {
		t.Fatalf("invalid profile target error = %v; want ErrTipTargetNotFound", err)
	}
}

func TestLiveTipsUseConfiguredCoinTransferFeeWhileOtherTargetsKeepCreatorProgramShare(t *testing.T) {
	liveSplit, err := splitTipCoins("live", 100, 7000, 200)
	if err != nil || liveSplit.CreatorAmountCoins != 98 || liveSplit.PlatformFeeCoins != 2 {
		t.Fatalf("live split = %+v, %v; want 98 recipient / 2 platform", liveSplit, err)
	}
	profileSplit, err := splitTipCoins("profile", 100, 7000, 200)
	if err != nil || profileSplit.CreatorAmountCoins != 70 || profileSplit.PlatformFeeCoins != 30 {
		t.Fatalf("profile split = %+v, %v; want existing 70/30 creator-program split", profileSplit, err)
	}
	if _, err := splitTipCoins("live", 100, 7000, 10_001); !errors.Is(err, models.ErrInvalidCoinFeeBps) {
		t.Fatalf("invalid configured live fee error = %v", err)
	}
}
