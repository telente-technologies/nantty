package payments_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"nantty/modules/payments/src/generated/ent/walletfunding"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/modules/gateway/services"
)

func TestWalletFundingReversalWaitsForProviderConfirmation(t *testing.T) {
	for _, test := range []struct {
		name           string
		providerStatus string
		wantStatus     walletfunding.Status
		wantApplied    int
	}{
		{name: "confirmed success", providerStatus: "SUCCESSFUL", wantStatus: walletfunding.StatusReversed, wantApplied: 1},
		{name: "confirmed failure", providerStatus: "FAILED", wantStatus: walletfunding.StatusHeld},
	} {
		t.Run(test.name, func(t *testing.T) {
			skipIntegrationWhenShort(t)
			harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
			ctx := context.Background()
			userId := uuid.NewString()
			harness.OnboardConnectedAccount(userId, false)
			fundingReference := harness.DepositToWallet(userId, 50_000)

			gateway := harness.Payments.Application.Gateway
			if err := gateway.RejectWalletFunding(ctx, fundingReference, "provider reversal test"); !errors.Is(err, services.ErrFundingReversalPending) {
				t.Fatalf("a provider NEW response must remain pending: %v", err)
			}
			client := harness.Payments.Application.Container.Client(harness.Database)
			funding := client.WalletFunding.Query().Where(walletfunding.ProviderReference(fundingReference)).OnlyX(ctx)
			if funding.Status != walletfunding.StatusReversalPending || funding.ReversedAt != nil {
				t.Fatalf("pending provider request must not reverse the funding: status=%s reversedAt=%v", funding.Status, funding.ReversedAt)
			}
			if !harness.Flutterwave.SetFundingReversalStatus(fundingReference, test.providerStatus) {
				t.Fatalf("could not set provider reversal status to %s", test.providerStatus)
			}

			report, err := gateway.RunDailyWalletReconciliation(ctx)
			if err != nil {
				t.Fatalf("reconcile provider reversal: %v", err)
			}
			funding = client.WalletFunding.GetX(ctx, funding.ID)
			if funding.Status != test.wantStatus {
				t.Fatalf("provider %s should leave funding %s, got %s", test.providerStatus, test.wantStatus, funding.Status)
			}
			if report.ReversalsApplied != test.wantApplied {
				t.Fatalf("provider %s should apply %d reversals, got %d (%+v)", test.providerStatus, test.wantApplied, report.ReversalsApplied, report)
			}
			if (test.providerStatus == "SUCCESSFUL") != (funding.ReversedAt != nil) {
				t.Fatalf("only provider-confirmed success may set reversedAt: status=%s reversedAt=%v", funding.Status, funding.ReversedAt)
			}
		})
	}
}
