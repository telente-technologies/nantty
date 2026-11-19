package paymentstesting

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func (fake *FakeFlutterwave) routeAccounts(request fakeFlwRequest) (int, any, any) {
	segments := request.segments
	switch {
	case segments[0] == "balances" && request.method == http.MethodGet:
		balances := []map[string]any{}
		for _, currency := range []string{"NGN", "GHS", "KES", "ZAR", "USD"} {
			balances = append(balances, map[string]any{"currency": currency, "available_balance": fakeMajor(fake.MainBalance[currency], currency), "ledger_balance": fakeMajor(fake.MainBalance[currency], currency)})
		}
		return http.StatusOK, balances, nil
	case segments[0] == "settlements" && len(segments) == 1:
		rows := []map[string]any{}
		for _, settlement := range fake.Settlements {
			row := map[string]any{}
			for key, value := range settlement {
				if key != "transactions" {
					row[key] = value
				}
			}
			rows = append(rows, row)
		}
		page, err := strconv.Atoi(request.query["page"])
		if err != nil || page < 1 {
			page = 1
		}
		const pageSize = 10
		start := (page - 1) * pageSize
		end := min(start+pageSize, len(rows))
		pageRows := []map[string]any{}
		if start < len(rows) {
			pageRows = append(pageRows, rows[start:end]...)
		}
		totalPages := (len(rows) + pageSize - 1) / pageSize
		if totalPages == 0 {
			totalPages = 1
		}
		return http.StatusOK, pageRows, map[string]any{"page_info": map[string]any{"total": len(rows), "current_page": page, "total_pages": totalPages}}
	case segments[0] == "settlements" && len(segments) == 2:
		for _, settlement := range fake.Settlements {
			if fmt.Sprint(settlement["id"]) == segments[1] {
				return http.StatusOK, settlement, nil
			}
		}
		return http.StatusNotFound, "Settlement not found", nil
	case segments[0] == "chargebacks" && request.method == http.MethodGet:
		rows := []map[string]any{}
		for _, chargeback := range fake.Chargebacks {
			if status := request.query["status"]; status == "" || chargeback["status"] == status {
				rows = append(rows, chargeback)
			}
		}
		page, err := strconv.Atoi(request.query["page"])
		if err != nil || page < 1 {
			page = 1
		}
		const pageSize = 20
		start := (page - 1) * pageSize
		end := min(start+pageSize, len(rows))
		pageRows := []map[string]any{}
		if start < len(rows) {
			pageRows = append(pageRows, rows[start:end]...)
		}
		totalPages := (len(rows) + pageSize - 1) / pageSize
		if totalPages == 0 {
			totalPages = 1
		}
		return http.StatusOK, pageRows, map[string]any{"page_info": map[string]any{"total": len(rows), "current_page": page, "total_pages": totalPages}}
	case segments[0] == "chargebacks" && request.method == http.MethodPut && len(segments) == 2:
		return fake.respondToChargeback(segments[1], request.body)
	case segments[0] == "banks" && len(segments) == 2:
		if fake.NullBankCatalog {
			return http.StatusOK, nil, nil
		}
		return http.StatusOK, []map[string]any{{"id": 1, "code": "044", "name": "Access Bank"}, {"id": 2, "code": "058", "name": "GTBank"}, {"id": 3, "code": "MTN", "name": "MTN Mobile Money"}, {"id": 4, "code": "BRANCH", "name": "Branch Bank"}}, nil
	case segments[0] == "banks" && len(segments) == 3 && segments[2] == "branches":
		if fake.NullBankBranchCatalog {
			return http.StatusOK, nil, nil
		}
		if segments[1] == "4" {
			return http.StatusOK, []map[string]any{{"id": 10, "branch_code": "BR-001", "branch_name": "Main Branch", "bank_id": 4}}, nil
		}
		return http.StatusOK, []map[string]any{}, nil
	case segments[0] == "accounts" && len(segments) == 2 && segments[1] == "resolve":
		number, bank := text(request.body["account_number"]), text(request.body["account_bank"])
		if number == "" || bank == "" || strings.HasPrefix(number, "0000") {
			return http.StatusBadRequest, "Sorry, that account number is invalid, please check and try again", nil
		}
		name := fake.BankAccountNames[bank+":"+number]
		if name == "" {
			name = "TEMITOPE ADEYEMI"
		}
		return http.StatusOK, map[string]any{"account_number": number, "account_name": name}, nil
	case segments[0] == "bvn" && len(segments) == 2 && request.method == http.MethodPost:
		bvn := text(request.body["bvn"])
		if len(bvn) != 11 {
			return http.StatusBadRequest, "Invalid BVN", nil
		}
		reference := fmt.Sprintf("FLWBVNREF%016d", fake.newId())
		fake.Consents[reference] = map[string]any{"first_name": strings.ToUpper(text(request.body["firstname"])), "last_name": strings.ToUpper(text(request.body["lastname"])), "bvn": bvn, "status": "COMPLETED"}
		return http.StatusOK, map[string]any{"url": fake.publicUrl() + "/consent/" + reference, "reference": reference}, nil
	case segments[0] == "bvn" && len(segments) == 3 && request.method == http.MethodGet:
		consent := fake.Consents[segments[2]]
		if consent == nil {
			return http.StatusNotFound, "Verification not found", nil
		}
		watchlisted := "NO"
		if strings.HasPrefix(text(consent["bvn"]), "999") {
			watchlisted = "YES"
		}
		return http.StatusOK, map[string]any{
			"first_name": consent["first_name"], "last_name": consent["last_name"], "status": consent["status"], "reference": segments[2],
			"bvn_data": map[string]any{"bvn": consent["bvn"], "firstName": consent["first_name"], "surname": consent["last_name"], "dateOfBirth": "03-Feb-1994", "phoneNumber1": "08030000000", "watchlisted": watchlisted, "faceImage": "aGVsbG8="},
		}, nil
	}
	return http.StatusNotFound, "Route not found", nil
}

func (fake *FakeFlutterwave) respondToChargeback(id string, body map[string]any) (int, any, any) {
	action := text(body["action"])
	if (action != "accept" && action != "decline") || text(body["comment"]) == "" {
		return http.StatusBadRequest, "action and comment are required", nil
	}
	for _, chargeback := range fake.Chargebacks {
		if fmt.Sprint(chargeback["id"]) == id {
			chargeback["status"] = map[string]string{"accept": "accepted", "decline": "declined"}[action]
			chargeback["comment"] = text(body["comment"])
			return http.StatusOK, chargeback, nil
		}
	}
	return http.StatusNotFound, "Chargeback not found", nil
}

func (fake *FakeFlutterwave) OpenChargeback(chargeReference string, amountMinor int64) (map[string]any, bool) {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, transaction := range fake.Transactions {
		if transaction.TxRef != chargeReference || transaction.Status != "successful" {
			continue
		}
		if amountMinor <= 0 {
			amountMinor = transaction.AmountMinor
		}
		fake.MainBalance[transaction.Currency] -= amountMinor
		chargeback := map[string]any{
			"id": fake.newId(), "amount": fakeMajor(amountMinor, transaction.Currency), "currency": transaction.Currency, "flw_ref": transaction.FlwRef, "tx_ref": transaction.TxRef,
			"transaction_id": transaction.Id, "status": "initiated", "stage": "new", "comment": "Customer disputed the charge",
			"due_date": time.Now().UTC().Add(48 * time.Hour).Format(time.RFC3339),
		}
		fake.Chargebacks = append(fake.Chargebacks, chargeback)
		return chargeback, true
	}
	return nil, false
}

func (fake *FakeFlutterwave) ResolveChargeback(id string, merchantWon bool) map[string]any {
	fake.mutex.Lock()
	defer fake.mutex.Unlock()
	for _, chargeback := range fake.Chargebacks {
		if fmt.Sprint(chargeback["id"]) != id {
			continue
		}
		chargeback["status"] = "lost"
		if merchantWon {
			chargeback["status"] = "won"
			amount, _ := fakeMinor(chargeback["amount"], text(chargeback["currency"]))
			fake.MainBalance[text(chargeback["currency"])] += amount
		}
		return chargeback
	}
	return nil
}
