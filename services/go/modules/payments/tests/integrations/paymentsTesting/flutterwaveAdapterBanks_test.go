package paymentstesting_test

import (
	"context"
	"errors"
	"testing"

	"nantty/modules/payments/src/interfaces"
)

func TestFlutterwaveBankLookupsNormalizeAndValidateCountryAndRequiredFields(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	ctx := context.Background()
	banks, err := adapter.ListBanks(ctx, " ng ")
	if err != nil || len(banks) == 0 || banks[0].CountryCode != "NG" {
		t.Fatalf("normalized ISO country should return the provider bank catalog: banks=%+v err=%v", banks, err)
	}
	requestsBeforeInvalid := len(fake.RequestLog())
	for _, country := range []string{"", "N", "N1", "NGH"} {
		if _, err := adapter.ListBanks(ctx, country); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
			t.Errorf("invalid country %q should fail before I/O: %v", country, err)
		}
	}
	if _, err := adapter.ResolveBankAccountNameInCountry(ctx, " gh ", " 044 ", " 0690000032 "); err != nil {
		t.Fatalf("Ghana resolution should normalize the documented ISO country code: %v", err)
	}
	requestsAfterGhana := len(fake.RequestLog())
	if _, err := adapter.ResolveBankAccountNameInCountry(ctx, "US", "044", "0690000032"); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		t.Fatalf("account resolution outside the documented NG/GH set should be rejected: %v", err)
	}
	for _, request := range []struct{ bank, account string }{{"", "123"}, {"044", ""}} {
		if _, err := adapter.ResolveBankAccountNameInCountry(ctx, "NG", request.bank, request.account); err == nil {
			t.Errorf("missing required bank/account fields should fail locally: %+v", request)
		}
	}
	if len(fake.RequestLog()) != requestsAfterGhana || requestsAfterGhana != requestsBeforeInvalid+1 {
		t.Fatalf("invalid country/bank/account data must not cause provider requests: %v", fake.RequestLog())
	}
}

func TestFlutterwaveBankCatalogRejectsMissingDataArray(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	fake.NullBankCatalog = true

	if banks, err := adapter.ListBanks(context.Background(), "NG"); err == nil || !errors.Is(err, interfaces.ErrProviderUnavailable) || banks != nil {
		t.Fatalf("a null provider bank catalog must fail closed, got banks=%+v err=%v", banks, err)
	}
}

func TestFlutterwaveBankBranchesResolveByProviderBankID(t *testing.T) {
	fake, adapter := newFakeFlutterwaveAdapter(t)
	banks, err := adapter.ListBanks(context.Background(), "NG")
	if err != nil || len(banks) == 0 || banks[0].ProviderID == 0 {
		t.Fatalf("bank provider ID must be retained internally: %+v %v", banks, err)
	}
	branches, err := adapter.ListBankBranches(context.Background(), "NG", "BRANCH")
	if err != nil || len(branches) != 1 || branches[0].Code != "BR-001" || branches[0].Name != "Main Branch" {
		t.Fatalf("branch lookup should use the bank ID and return branch codes: %+v %v", branches, err)
	}
	withoutBranches, err := adapter.ListBankBranches(context.Background(), "NG", "044")
	if err != nil || len(withoutBranches) != 0 {
		t.Fatalf("banks with no branches should return an empty list: %+v %v", withoutBranches, err)
	}
	fake.NullBankBranchCatalog = true
	if _, err := adapter.ListBankBranches(context.Background(), "NG", "BRANCH"); err == nil {
		t.Fatal("a null branch catalog must fail closed rather than look like a bank without branches")
	}
	fake.NullBankBranchCatalog = false
	if _, err := adapter.ListBankBranches(context.Background(), "N1", "BRANCH"); !errors.Is(err, interfaces.ErrCurrencyNotSupported) {
		t.Fatalf("invalid country must be rejected before provider access: %v", err)
	}
	fake.FundMainBalance("NGN", 100_000)
	if _, err := adapter.CreateTransfer(context.Background(), interfaces.TransferRequest{Reference: "branch-payout-missing", AmountMinor: 10_000, Currency: "NGN", BankCode: "BRANCH", AccountNumber: "0123456789"}); err == nil {
		t.Fatal("provider must reject a branch-requiring destination if no branch is sent")
	}
	if _, err := adapter.CreateTransfer(context.Background(), interfaces.TransferRequest{Reference: "branch-payout-valid", AmountMinor: 10_000, Currency: "NGN", BankCode: "BRANCH", BranchCode: "BR-001", AccountNumber: "0123456789"}); err != nil {
		t.Fatalf("selected branch code should be passed through to the transfer: %v", err)
	}
	if transfer := fake.TransferByReference("branch-payout-valid"); transfer == nil || transfer.DestinationBranchCode != "BR-001" {
		t.Fatalf("recorded transfer should retain selected branch: %+v", transfer)
	}
}
