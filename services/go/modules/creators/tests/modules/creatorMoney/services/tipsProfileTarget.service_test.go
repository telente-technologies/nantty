package services_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"nantty/modules/creators/src/modules/creatorMoney/services"
	"nantty/modules/creators/src/modules/liveMoney/models"
)

func TestResolveTipCreatorAcceptsOnlyUUIDProfileTargets(t *testing.T) {
	money := services.CreatorMoney{}
	creatorID := uuid.NewString()
	got, err := money.ResolveTipCreator(context.Background(), services.TipRequest{TargetType: "profile", TargetId: creatorID})
	if err != nil || got != creatorID {
		t.Fatalf("valid profile target = %q, %v; want %q, nil", got, err, creatorID)
	}
	if _, err := money.ResolveTipCreator(context.Background(), services.TipRequest{TargetType: "profile", TargetId: "not-a-uuid"}); err != services.ErrTipTargetNotFound {
		t.Fatalf("invalid profile target error = %v; want ErrTipTargetNotFound", err)
	}
}

func TestLiveTipsUseConfiguredCoinTransferFeeWhileOtherTargetsKeepCreatorProgramShare(t *testing.T) {
	liveSplit, err := services.SplitTipCoins("live", 100, 7000, 200)
	if err != nil || liveSplit.CreatorAmountCoins != 98 || liveSplit.PlatformFeeCoins != 2 {
		t.Fatalf("live split = %+v, %v; want 98 recipient / 2 platform", liveSplit, err)
	}
	profileSplit, err := services.SplitTipCoins("profile", 100, 7000, 200)
	if err != nil || profileSplit.CreatorAmountCoins != 70 || profileSplit.PlatformFeeCoins != 30 {
		t.Fatalf("profile split = %+v, %v; want existing 70/30 creator-program split", profileSplit, err)
	}
	if _, err := services.SplitTipCoins("live", 100, 7000, 10_001); !errors.Is(err, models.ErrInvalidCoinFeeBps) {
		t.Fatalf("invalid configured live fee error = %v", err)
	}
}
