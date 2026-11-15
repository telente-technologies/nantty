package payments_test

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ledger/src/databases"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	"nantty/modules/payments/src/modules/gateway/models"
	"nantty/modules/payments/src/modules/gateway/services"
)

func prepareDirectPayout(harness *paymentstesting.MoneyHarness, sellerId string) error {
	return databases.RunInMoneyTransaction(context.Background(), harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.Payments.Application.Gateway.PrepareDirectSellerPayoutInTransaction(ctx, transaction, models.SellerPayoutInstruction{
			Purpose: "direct_sale", SubjectId: uuid.NewString(), BeneficiaryUserId: sellerId, Reference: "dsp_" + strings.ReplaceAll(uuid.NewString(), "-", ""),
			AmountMinor: 9_000, FeeMinor: 100, Currency: "USD",
		})
		return err
	})
}

func TestADirectSalePayoutNeedsPayoutVerificationAConfirmedRecipientAndNoDebt(t *testing.T) {
	skipIntegrationWhenShort(t)
	harness := paymentstesting.StartMoneyHarnessWithPayments(t, nil)
	unverified := uuid.NewString()
	harness.SetCountry(unverified, "NG")
	gateway := harness.Payments.Application.Gateway
	if err := gateway.SavePayoutOnboardingIdentity(context.Background(), unverified, services.OnboardingIdentityInput{
		Role: "seller", LegalName: "Temitope Adeyemi", DateOfBirth: "1994-02-03", AddressLine1: "4 Allen Avenue", City: "Ikeja", State: "Lagos", IdType: "bvn", IdNumber: "22212345678",
	}); err != nil {
		t.Fatal(err)
	}
	if err := gateway.SavePayoutOnboardingBank(context.Background(), unverified, services.OnboardingBankInput{BankCode: "058", BankName: "Guaranty Trust Bank", AccountNumber: paymentstesting.TestBankAccountNumberFor(unverified)}); err != nil {
		t.Fatal(err)
	}
	if err := prepareDirectPayout(harness, unverified); err == nil {
		t.Fatal("a seller with an unconfirmed recipient and no payout verification must not be paid out directly")
	}
	verified := uuid.NewString()
	harness.OnboardConnectedAccount(verified, true)
	if err := gateway.RecordSellerVerification(context.Background(), verified, uuid.NewString(), time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := prepareDirectPayout(harness, verified); err != nil {
		t.Fatalf("a verified seller with a confirmed recipient is paid: %v", err)
	}
	if err := databases.RunInMoneyTransaction(context.Background(), harness.Database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.Ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{Reference: "debt-" + verified, Kind: "test.debt", Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.SellerDebtAccount(verified, "USD"), Direction: ledgermodels.Debit, AmountMinor: 500},
			{Account: ledgermodels.CreatorCoinPayoutExpenseAccount("USD"), Direction: ledgermodels.Credit, AmountMinor: 500},
		}})
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if err := prepareDirectPayout(harness, verified); !errors.Is(err, services.ErrDirectPayoutDebtOutstanding) {
		t.Fatalf("a seller who owes money is not paid out directly: %v", err)
	}
}
