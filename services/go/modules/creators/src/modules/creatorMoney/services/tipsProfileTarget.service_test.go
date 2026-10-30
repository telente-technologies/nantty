package services

import (
	"context"
	"testing"

	"github.com/google/uuid"
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
