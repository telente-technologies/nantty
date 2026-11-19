package integrations

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"nantty/modules/payments/src/interfaces"
)

type flutterwaveChargeback struct {
	Id            json.Number     `json:"id"`
	Amount        json.RawMessage `json:"amount"`
	Currency      string          `json:"currency"`
	FlwRef        string          `json:"flw_ref"`
	TxRef         string          `json:"tx_ref"`
	TransactionId json.Number     `json:"transaction_id"`
	Status        string          `json:"status"`
	Comment       string          `json:"comment"`
	DueDate       string          `json:"due_date"`
}

func FlutterwaveChargebackOutcome(status string) string {
	switch strings.ToLower(status) {
	case "won", "reversed":
		return "won"
	case "lost", "accepted":
		return "lost"
	}
	return "open"
}

func (chargeback flutterwaveChargeback) toProviderDispute() (interfaces.ProviderDispute, error) {
	currency := strings.ToUpper(firstNonEmptyString(chargeback.Currency, "NGN"))
	amount, err := flutterwaveAmountMinor(chargeback.Amount, currency)
	if err != nil {
		return interfaces.ProviderDispute{}, err
	}
	return interfaces.ProviderDispute{
		ProviderDisputeId: chargeback.Id.String(), ProviderChargeId: chargeback.TransactionId.String(), ChargeReference: chargeback.TxRef,
		AmountMinor: amount, Currency: currency, Status: FlutterwaveChargebackOutcome(chargeback.Status), Reason: truncate(chargeback.Comment, 200),
		ResponseDeadlineAt: flutterwaveTime(chargeback.DueDate),
	}, nil
}

func (provider *FlutterwaveProvider) listChargebacks(ctx context.Context, query url.Values) ([]interfaces.ProviderDispute, error) {
	const maxPages = 50
	var disputes []interfaces.ProviderDispute
	for page := 1; page <= maxPages; page++ {
		query.Set("page", strconv.Itoa(page))
		var rows []flutterwaveChargeback
		envelope, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodGet, path: "/chargebacks", query: query}, &rows)
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			dispute, err := row.toProviderDispute()
			if err != nil {
				return nil, err
			}
			disputes = append(disputes, dispute)
		}
		hasNext, err := flutterwavePageHasNext(envelope.Meta, page)
		if err != nil {
			return nil, errors.Join(interfaces.ErrProviderUnavailable, err)
		}
		if !hasNext {
			return disputes, nil
		}
	}
	return nil, errors.Join(interfaces.ErrProviderUnavailable, errors.New("flutterwave chargeback history exceeded the pagination limit"))
}

func (provider *FlutterwaveProvider) ListOpenDisputes(ctx context.Context) ([]interfaces.ProviderDispute, error) {
	var disputes []interfaces.ProviderDispute
	for _, status := range []string{"initiated", "declined"} {
		page, err := provider.listChargebacks(ctx, url.Values{"status": {status}})
		if err != nil {
			return nil, err
		}
		disputes = append(disputes, page...)
	}
	return disputes, nil
}

func (provider *FlutterwaveProvider) ListResolvedDisputes(ctx context.Context, since time.Time) ([]interfaces.ProviderDispute, error) {
	var disputes []interfaces.ProviderDispute
	for _, status := range []string{"won", "lost", "accepted"} {
		query := url.Values{"status": {status}, "from": {since.UTC().Format("2006-01-02")}, "to": {provider.Now().AddDate(0, 0, 1).UTC().Format("2006-01-02")}}
		page, err := provider.listChargebacks(ctx, query)
		if err != nil {
			return nil, err
		}
		disputes = append(disputes, page...)
	}
	return disputes, nil
}

func (provider *FlutterwaveProvider) SubmitDisputeEvidence(ctx context.Context, evidence interfaces.DisputeEvidence) error {
	comment := strings.TrimSpace(evidence.ProductDescription + "\n" + evidence.Notes)
	if comment == "" {
		return errors.New("flutterwave: declining a chargeback needs a comment")
	}
	body := map[string]any{"action": "decline", "comment": truncate(comment, 1000)}
	path := "/chargebacks/" + url.PathEscape(evidence.ProviderDisputeId)
	_, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPut, path: path, body: body}, nil)
	return err
}

func (provider *FlutterwaveProvider) AcceptDispute(ctx context.Context, providerDisputeId, comment string) error {
	body := map[string]any{"action": "accept", "comment": truncate(firstNonEmptyString(comment, "accepted"), 1000)}
	_, err := provider.http.send(ctx, flutterwaveRequest{method: http.MethodPut, path: "/chargebacks/" + url.PathEscape(providerDisputeId), body: body}, nil)
	return err
}

func flutterwavePayeeCode(prefix, bankCode, accountNumber string) string {
	digest := sha256.Sum256([]byte(bankCode + ":" + accountNumber))
	return prefix + bankCode + ":" + hex.EncodeToString(digest[:8])
}

func (provider *FlutterwaveProvider) FindTransferRecipient(_ context.Context, account interfaces.PayeeBankAccount) (string, bool, error) {
	if account.BankCode == "" || account.AccountNumber == "" {
		return "", false, nil
	}
	return flutterwavePayeeCode("flwbank:", account.BankCode, account.AccountNumber), true, nil
}

func (provider *FlutterwaveProvider) CreateTransferRecipient(ctx context.Context, account interfaces.PayeeBankAccount) (string, error) {
	code, _, err := provider.FindTransferRecipient(ctx, account)
	if code == "" && err == nil {
		err = interfaces.ErrBankAccountNotFound
	}
	return code, err
}

func (provider *FlutterwaveProvider) FindSettlementSubaccount(_ context.Context, request interfaces.SettlementSubaccountRequest) (string, bool, error) {
	if request.BankCode == "" || request.AccountNumber == "" {
		return "", false, nil
	}
	return flutterwavePayeeCode("flwdirect:", request.BankCode, request.AccountNumber), true, nil
}

func (provider *FlutterwaveProvider) CreateSettlementSubaccount(ctx context.Context, request interfaces.SettlementSubaccountRequest) (string, error) {
	code, _, err := provider.FindSettlementSubaccount(ctx, request)
	if code == "" && err == nil {
		err = interfaces.ErrBankAccountNotFound
	}
	return code, err
}
