package flutterwaveflows

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"nantty/modules/escrow/src/generated/ent"
	"nantty/modules/escrow/src/generated/ent/escrow"
	confirmorderreceipt "nantty/modules/escrow/src/modules/escrows/commands/confirmOrderReceipt"
	paymentstesting "nantty/modules/payments/src/integrations/paymentsTesting"
	paymentmodels "nantty/modules/payments/src/modules/gateway/models"
)

type order struct {
	checkoutId, orderId, reference string
}

func (harness *flowHarness) registerOrder(buyer, seller string, amountMinor int64, currency, mode string) order {
	harness.T.Helper()
	placed := order{checkoutId: uuid.NewString(), orderId: uuid.NewString()}
	payables := harness.payablesFor(buyer, seller, amountMinor, currency)
	payables[0].CheckoutId, payables[0].OrderId, payables[0].OrderReference = placed.checkoutId, placed.orderId, "ZM-"+placed.orderId[:5]
	payables[0].PaymentMode, payables[0].StoreVerified = mode, mode == "direct"
	err := harness.gateway.RegisterCheckoutPayables(context.Background(), payables)
	if err != nil {
		harness.T.Fatalf("register checkout: %v", err)
	}
	return placed
}

func (harness *flowHarness) initialize(buyer string, placed *order) paymentstesting.HarnessResponse {
	harness.T.Helper()
	response := harness.Call(http.MethodPost, "/api/v1/payments/initialize", harness.Tokens.UserAccessToken(buyer), "init-"+placed.orderId, map[string]any{"checkoutId": placed.checkoutId})
	if response.Status != http.StatusCreated {
		harness.T.Fatalf("initialize: %d %s", response.Status, response.Raw)
	}
	placed.reference = response.Body["reference"].(string)
	return response
}

func (harness *flowHarness) payWithWallet(buyer string, placed order, key string) paymentstesting.HarnessResponse {
	harness.T.Helper()
	return harness.Call(http.MethodPost, "/api/v1/payments/wallet-payments/"+placed.reference, harness.Tokens.UserAccessToken(buyer), key, nil)
}

func (harness *flowHarness) payByCard(placed order, appFeeMinor int64) {
	harness.T.Helper()
	transaction := harness.fake.CompleteCheckout(placed.reference, 0, appFeeMinor, "card")
	if transaction == nil {
		harness.T.Fatalf("no checkout for %s", placed.reference)
	}
	body, headers := harness.fake.ChargeWebhook(transaction)
	if response := harness.deliver(body, headers); response.Status != http.StatusOK {
		harness.T.Fatalf("charge webhook: %d %s", response.Status, response.Raw)
	}
}

func (harness *flowHarness) escrowFor(placed order) *ent.Escrow {
	harness.T.Helper()
	held, err := harness.escrow.Application.Container.Client(harness.Database).Escrow.Query().Where(escrow.OrderID(placed.orderId)).Only(context.Background())
	if err != nil {
		harness.T.Fatalf("escrow for %s: %v", placed.orderId, err)
	}
	return held
}

func (harness *flowHarness) confirmReceipt(buyer string, placed order) error {
	_, err := confirmorderreceipt.Handler{Application: harness.escrow.Application}.Execute(context.Background(), confirmorderreceipt.Command{OrderId: placed.orderId, BuyerUserId: buyer})
	return err
}

func (harness *flowHarness) settleCard(currency string) {
	harness.T.Helper()
	harness.fake.SettleAll(currency)
	harness.gateway.ProcessProviderSettlements(context.Background(), nil)
	harness.runWorkers()
}

func (harness *flowHarness) addPayoutAccount(userId, bankCode string) string {
	harness.T.Helper()
	token := harness.Tokens.UserAccessToken(userId)
	added := harness.Call(http.MethodPost, "/api/v1/wallets/me/payout-accounts", token, "add-"+userId, map[string]any{
		"countryCode": "NG", "bankCode": bankCode, "accountNumber": paymentstesting.TestBankAccountNumberFor(userId),
	}, harness.StepUpFor(token))
	if added.Status != http.StatusCreated && added.Status != http.StatusOK {
		harness.T.Fatalf("add payout account: %d %s", added.Status, added.Raw)
	}
	return added.Body["id"].(string)
}

func (harness *flowHarness) withdraw(userId, accountId string, amountMinor int64, key string, stepUp bool) paymentstesting.HarnessResponse {
	token := harness.Tokens.UserAccessToken(userId)
	var headers []http.Header
	if stepUp {
		headers = append(headers, harness.StepUpFor(token))
	}
	return harness.Call(http.MethodPost, "/api/v1/wallets/me/withdrawals", token, key, map[string]any{
		"payoutAccountId": accountId, "amount": map[string]any{"amountMinor": amountMinor, "currency": "NGN"},
	}, headers...)
}

func (harness *flowHarness) markSellerBusinessVerified(seller string) {
	harness.T.Helper()
	if err := harness.gateway.RecordSellerVerification(context.Background(), seller, uuid.NewString(), time.Now()); err != nil {
		harness.T.Fatal(err)
	}
}

func (harness *flowHarness) payablesFor(buyer, seller string, amountMinor int64, currency string) []paymentmodels.OrderPayable {
	orderId := uuid.NewString()
	return []paymentmodels.OrderPayable{{
		CheckoutId: uuid.NewString(), OrderId: orderId, OrderReference: "ZM-" + orderId[:5], BuyerUserId: buyer, StoreId: uuid.NewString(),
		SellerUserId: seller, AmountMinor: amountMinor, Currency: currency, ProductSummary: "Ankara dress", PaymentMode: "escrow",
	}}
}
