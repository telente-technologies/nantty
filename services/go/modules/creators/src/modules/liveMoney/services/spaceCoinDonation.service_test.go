package services

import (
	"errors"
	"testing"

	"nantty/modules/creators/src/modules/liveMoney/models"
)

func TestValidateSpaceCoinDonationRequiresIdentityKeyAndServerRange(t *testing.T) {
	valid := SpaceCoinDonationRequest{SenderUserID: "sender", SpaceID: "space", Coins: 25, IdempotencyKey: "donation-key-01"}
	if err := validateSpaceCoinDonation(valid, 5, 80); err != nil {
		t.Fatalf("valid donation rejected: %v", err)
	}
	for _, amount := range []int64{0, 4, 81, 1 << 62} {
		request := valid
		request.Coins = amount
		err := validateSpaceCoinDonation(request, 5, 80)
		var failure *LiveMoneyError
		if !errors.As(err, &failure) || failure.Reason != "INVALID_DONATION_AMOUNT" || failure.MinimumCoins != 5 || failure.MaximumCoins != 80 {
			t.Errorf("amount %d error = %#v", amount, err)
		}
	}

	missingKey := valid
	missingKey.IdempotencyKey = ""
	if err := validateSpaceCoinDonation(missingKey, 5, 80); err == nil {
		t.Fatal("missing idempotency key accepted")
	}
	invalidPolicy := validateSpaceCoinDonation(valid, 0, 80)
	var failure *LiveMoneyError
	if !errors.As(invalidPolicy, &failure) || failure.Reason != "INVALID_DONATION_AMOUNT" {
		t.Fatalf("invalid server policy = %#v", invalidPolicy)
	}
}

func TestSpaceDonationUsesConfiguredCoinTransferFeeAfterCreatorApproval(t *testing.T) {
	for _, test := range []struct{ coins, feeBps, creator, platform int64 }{{51, 200, 50, 1}, {100, 200, 98, 2}} {
		split, err := spaceCoinDonationSplit(test.coins, 5, 100, test.feeBps)
		if err != nil || split.CreatorAmountCoins != test.creator || split.PlatformFeeCoins != test.platform {
			t.Fatalf("approved-host donation split(%d) = %+v, %v", test.coins, split, err)
		}
	}
	if _, err := spaceCoinDonationSplit(101, 5, 100, 200); !errors.Is(err, models.ErrInvalidDonation) {
		t.Fatalf("out-of-policy donation error = %v", err)
	}
}
