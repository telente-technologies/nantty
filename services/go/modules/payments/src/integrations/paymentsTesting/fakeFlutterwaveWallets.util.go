package paymentstesting

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (fake *FakeFlutterwave) routeWallets(request fakeFlwRequest) (int, any, any) {
	segments := request.segments
	switch {
	case request.method == http.MethodPost && len(segments) == 1:
		return fake.createWallet(request.body)
	case request.method == http.MethodGet && len(segments) == 1:
		found := []map[string]any{}
		for _, wallet := range fake.Wallets {
			matches := (request.query["email"] != "" && wallet.Email == request.query["email"]) || (request.query["account_reference"] != "" && wallet.Ref == request.query["account_reference"]) ||
				(request.query["nuban"] != "" && containsString(wallet.FundingNumbers, request.query["nuban"]))
			if matches && wallet.Status != "DELETED" {
				found = append(found, fake.walletJson(wallet))
			}
		}
		return http.StatusOK, found, map[string]any{"page_info": map[string]any{"total": len(found)}}
	case request.method == http.MethodPost && len(segments) == 2 && segments[1] == "refunds":
		return fake.reverseFunding(request.body)
	case request.method == http.MethodGet && len(segments) == 2 && segments[1] == "refunds":
		status := request.query["status"]
		if status == "" {
			status = "SUCCESSFUL"
		}
		filtered := make([]map[string]any, 0, len(fake.Reversals))
		for _, reversal := range fake.Reversals {
			if strings.EqualFold(text(reversal["status"]), status) {
				filtered = append(filtered, reversal)
			}
		}
		page, err := strconv.Atoi(request.query["page"])
		if err != nil || page < 1 {
			page = 1
		}
		if fake.IgnoreReversalPage {
			page = 1
		}
		const pageSize = 1
		start := (page - 1) * pageSize
		end := min(start+pageSize, len(filtered))
		transfers := []map[string]any{}
		if start < len(filtered) {
			transfers = append(transfers, filtered[start:end]...)
		}
		totalPages := (len(filtered) + pageSize - 1) / pageSize
		result := map[string]any{"transfers": transfers}
		if !fake.OmitReversalPageInfo {
			result["page_info"] = map[string]any{"total": len(filtered), "current_page": page, "total_pages": totalPages}
		}
		return http.StatusOK, result, nil
	}
	wallet := fake.Wallets[segments[1]]
	if wallet == nil || wallet.Status == "DELETED" {
		return http.StatusBadRequest, "Account reference is Invalid", nil
	}
	switch {
	case request.method == http.MethodGet && len(segments) == 2:
		return http.StatusOK, fake.walletJson(wallet), nil
	case request.method == http.MethodDelete && len(segments) == 2:
		wallet.Status = "DELETED"
		return http.StatusOK, nil, nil
	case request.method == http.MethodGet && segments[2] == "balances":
		return http.StatusOK, map[string]any{"currency": "NGN", "available_balance": fakeMajor(wallet.BalanceMinor, "NGN"), "ledger_balance": fakeMajor(wallet.BalanceMinor, "NGN")}, nil
	case request.method == http.MethodGet && segments[2] == "transactions":
		if request.query["from"] == "" || request.query["to"] == "" {
			return http.StatusBadRequest, "from and to are required", nil
		}
		page, err := strconv.Atoi(request.query["page"])
		if err != nil || page < 1 {
			page = 1
		}
		limit, err := strconv.Atoi(request.query["fetch_limit"])
		if err != nil || limit < 1 {
			limit = len(wallet.Lines)
		}
		start := (page - 1) * limit
		end := min(start+limit, len(wallet.Lines))
		transactions := []map[string]any{}
		if start < len(wallet.Lines) {
			transactions = append(transactions, wallet.Lines[start:end]...)
		}
		return http.StatusOK, map[string]any{"transactions": transactions}, nil
	case request.method == http.MethodGet && segments[2] == "static-account":
		accounts := []map[string]any{}
		for _, number := range wallet.FundingNumbers {
			accounts = append(accounts, map[string]any{"static_account": number, "bank_name": "Flutterwave MFB", "bank_code": "090567"})
		}
		return http.StatusOK, accounts, nil
	}
	return http.StatusNotFound, "Route not found", nil
}

func containsString(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

func (fake *FakeFlutterwave) walletJson(wallet *FakeFlwWallet) map[string]any {
	return map[string]any{
		"id": 1, "account_reference": wallet.Ref, "account_name": wallet.Name, "barter_id": wallet.BarterId, "email": wallet.Email, "mobilenumber": "",
		"country": "NG", "nuban": wallet.Nuban, "bank_name": "Flutterwave MFB", "bank_code": "090567", "status": wallet.Status,
	}
}

func (fake *FakeFlutterwave) createWallet(body map[string]any) (int, any, any) {
	email, name := text(body["email"]), text(body["account_name"])
	if email == "" || name == "" || text(body["country"]) == "" {
		return http.StatusBadRequest, "account_name, email and country are required", nil
	}
	for _, wallet := range fake.Wallets {
		if wallet.Email == email {
			return http.StatusBadRequest, "A payout subaccount with this email already exists", nil
		}
	}
	id := fake.newId()
	wallet := &FakeFlwWallet{
		Ref: fmt.Sprintf("PSA%012d", id), BarterId: fmt.Sprintf("234%09d", id%1_000_000_000), Nuban: fmt.Sprintf("8%09d", id%1_000_000_000),
		Email: email, Name: name, Status: "ACTIVE",
	}
	wallet.FundingNumbers = []string{wallet.Nuban, fmt.Sprintf("9%09d", id%1_000_000_000)}
	fake.Wallets[wallet.Ref] = wallet
	return http.StatusOK, fake.walletJson(wallet), nil
}

func (fake *FakeFlutterwave) reverseFunding(body map[string]any) (int, any, any) {
	fundingReference := strings.TrimPrefix(text(body["funding_reference"]), "PSA_")
	reference := "PSA_" + fundingReference
	for _, wallet := range fake.Wallets {
		for _, line := range wallet.Lines {
			if line["reference"] != reference || line["type"] != "C" {
				continue
			}
			amount, _ := fakeMinor(strings.ReplaceAll(text(line["amount"]), ",", ""), "NGN")
			reversal := map[string]any{
				"id": fake.newId(), "reference": fmt.Sprintf("REV-%d", fake.newId()), "narration": "Refund for: " + fundingReference,
				"status": "PENDING", "amount": fakeMajor(amount, "NGN"), "currency": "NGN", "account_number": wallet.Nuban,
			}
			fake.Reversals = append(fake.Reversals, reversal)
			return http.StatusOK, map[string]any{
				"id": reversal["id"], "status": "NEW", "currency": "NGN", "debit_currency": "NGN", "amount": fakeMajor(amount, "NGN"), "reference": reversal["reference"],
			}, nil
		}
	}
	return http.StatusBadRequest, "Funding reference not found", nil
}

func (fake *FakeFlutterwave) routeTransfers(request fakeFlwRequest) (int, any, any) {
	segments := request.segments
	switch {
	case request.method == http.MethodPost && len(segments) == 1:
		return fake.createTransfer(request.body)
	case request.method == http.MethodGet && len(segments) == 1:
		found := []map[string]any{}
		if transfer := fake.Transfers[request.query["reference"]]; transfer != nil {
			found = append(found, fake.transferJson(transfer))
		}
		return http.StatusOK, found, nil
	case request.method == http.MethodGet && len(segments) == 2 && segments[1] == "fee":
		currency := request.query["currency"]
		fee := any(fakeMajor(fake.BankTransferFeeMinor, currency))
		if fake.PayoutFeeValue != nil {
			fee = fake.PayoutFeeValue
		}
		return http.StatusOK, []map[string]any{{"fee_type": "value", "currency": currency, "fee": fee}}, nil
	case request.method == http.MethodGet && len(segments) == 2:
		for _, transfer := range fake.Transfers {
			if strconv.FormatInt(transfer.Id, 10) == segments[1] {
				return http.StatusOK, fake.transferJson(transfer), nil
			}
		}
		return http.StatusNotFound, "Transfer not found", nil
	case len(segments) == 3 && segments[2] == "retries":
		return http.StatusBadRequest, "retries are not allowed in this fake", nil
	}
	return http.StatusNotFound, "Route not found", nil
}

func (fake *FakeFlutterwave) transferJson(transfer *FakeFlwTransfer) map[string]any {
	return map[string]any{
		"id": transfer.Id, "account_number": transfer.Account, "bank_code": transfer.AccountBank, "currency": transfer.Currency, "debit_currency": transfer.Currency,
		"amount": fakeMajor(transfer.AmountMinor, transfer.Currency), "fee": fakeMajor(transfer.FeeMinor, transfer.Currency), "status": transfer.Status,
		"reference": transfer.Reference, "narration": transfer.Narration, "complete_message": transfer.CompleteMessage, "requires_approval": 0, "is_approved": 1,
		"created_at": time.Now().UTC().Format(time.RFC3339),
	}
}

func (fake *FakeFlutterwave) createTransfer(body map[string]any) (int, any, any) {
	reference, currency := text(body["reference"]), text(body["currency"])
	amount, valid := fakeMinor(body["amount"], currency)
	if reference == "" || !valid || text(body["account_bank"]) == "" || text(body["account_number"]) == "" {
		return http.StatusBadRequest, "account_bank, account_number, amount, currency and reference are required", nil
	}
	if fake.Transfers[reference] != nil {
		return http.StatusBadRequest, "Payout with this ref already exists", nil
	}
	transfer := &FakeFlwTransfer{
		Id: fake.newId(), Reference: reference, Currency: currency, AccountBank: text(body["account_bank"]), Account: text(body["account_number"]),
		DebitSubaccount: text(body["debit_subaccount"]), Narration: text(body["narration"]), AmountMinor: amount, Status: "NEW",
		Internal: text(body["account_bank"]) == "flutterwave", SkipBeneficiary: text(body["skip_beneficiary_creation"]) == "1",
	}
	if !transfer.Internal {
		transfer.FeeMinor = fake.BankTransferFeeMinor
	}
	if status, message := fake.debitTransferSource(transfer); status != http.StatusOK {
		return status, message, nil
	}
	fake.Transfers[reference] = transfer
	response := fake.transferJson(transfer)
	if transfer.Internal {
		fake.creditInternalDestination(transfer)
		transfer.Status = "SUCCESSFUL"
	}
	return http.StatusOK, response, nil
}

func (fake *FakeFlutterwave) debitTransferSource(transfer *FakeFlwTransfer) (int, string) {
	total := transfer.AmountMinor + transfer.FeeMinor
	if transfer.DebitSubaccount == "" {
		if fake.MainBalance[transfer.Currency] < total {
			return http.StatusBadRequest, "Insufficient balance in your wallet"
		}
		fake.MainBalance[transfer.Currency] -= total
		return http.StatusOK, ""
	}
	wallet := fake.Wallets[transfer.DebitSubaccount]
	if wallet == nil || wallet.Status == "DELETED" {
		return http.StatusBadRequest, "Account reference is Invalid"
	}
	if wallet.BalanceMinor < total {
		return http.StatusBadRequest, "Insufficient balance in payout subaccount"
	}
	wallet.BalanceMinor -= total
	fake.walletLine(wallet, "D", transfer.Reference, transfer.AmountMinor, transfer.Narration)
	if transfer.FeeMinor > 0 {
		fake.walletLine(wallet, "D", transfer.Reference+"_FEE", transfer.FeeMinor, "TRANSFER FEE")
	}
	return http.StatusOK, ""
}

func (fake *FakeFlutterwave) creditInternalDestination(transfer *FakeFlwTransfer) {
	if transfer.Account == FakeFlutterwaveMerchantId {
		fake.MainBalance[transfer.Currency] += transfer.AmountMinor
		return
	}
	if wallet := fake.walletByBarter(transfer.Account); wallet != nil && wallet.Status != "DELETED" {
		wallet.BalanceMinor += transfer.AmountMinor
		fake.walletLine(wallet, "C", transfer.Reference, transfer.AmountMinor, transfer.Narration)
		return
	}
	fake.refundTransferSource(transfer)
	transfer.Status, transfer.CompleteMessage = "FAILED", "destination wallet not found"
}

func (fake *FakeFlutterwave) refundTransferSource(transfer *FakeFlwTransfer) {
	total := transfer.AmountMinor + transfer.FeeMinor
	if wallet := fake.Wallets[transfer.DebitSubaccount]; wallet != nil {
		wallet.BalanceMinor += total
		fake.walletLine(wallet, "C", transfer.Reference+"_REVERSAL", total, "TRANSFER REVERSAL")
		return
	}
	fake.MainBalance[transfer.Currency] += total
}
