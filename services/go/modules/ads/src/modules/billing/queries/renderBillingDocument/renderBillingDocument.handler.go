package renderbillingdocument

import (
	"context"
	"regexp"
	"time"

	"github.com/google/uuid"

	"nantty/modules/ads/src/container"
	adserrors "nantty/modules/ads/src/errors"
	"nantty/modules/ads/src/generated/ent"
	"nantty/modules/ads/src/generated/ent/adfundstransaction"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/billing/services"
	reportingservices "nantty/modules/ads/src/modules/reporting/services"
	adsservices "nantty/modules/ads/src/services"
)

var unsafeFileCharacters = regexp.MustCompile(`[^A-Za-z0-9_-]`)

type Handler struct{ Container *container.Container }

func (handler Handler) Invoice(ctx context.Context, query Query) (Document, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionBillingView)
	if err != nil {
		return Document{}, err
	}
	invoices, err := services.BuildMonthlyInvoices(ctx, deployed.Database, account, deployed.Now())
	if err != nil {
		return Document{}, err
	}
	for _, invoice := range invoices {
		if invoice.Id != query.InvoiceId {
			continue
		}
		bytes := reportingservices.BuildLabelledDocumentPdf("Tax invoice", [][2]string{
			{"Invoice", invoice.Number}, {"Ad account", account.Name + " (" + account.ID.String() + ")"}, {"Period", invoice.PeriodStart + " to " + invoice.PeriodEnd},
			{"Subtotal", services.FormatMinor(invoice.Subtotal.AmountMinor, invoice.Subtotal.Currency)}, {"VAT", services.FormatMinor(invoice.Tax.AmountMinor, invoice.Tax.Currency)},
			{"Total", services.FormatMinor(invoice.Total.AmountMinor, invoice.Total.Currency)}, {"Status", invoice.Status}, {"Issued", invoice.IssuedAt},
		})
		return Document{FileName: invoice.Number + ".pdf", Bytes: bytes}, nil
	}
	return Document{}, adserrors.InvoiceNotFound
}

func (handler Handler) Receipt(ctx context.Context, query Query) (Document, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionBillingView)
	if err != nil {
		return Document{}, err
	}
	transactionId, err := uuid.Parse(query.TransactionId)
	if err != nil {
		return Document{}, adserrors.TransactionNotFound
	}
	transaction, err := deployed.Client.AdFundsTransaction.Query().Where(adfundstransaction.ID(transactionId), adfundstransaction.AccountID(account.ID)).Only(ctx)
	if ent.IsNotFound(err) {
		return Document{}, adserrors.TransactionNotFound
	}
	if err != nil {
		return Document{}, err
	}
	if !services.ReceiptedTransactionTypes[string(transaction.Type)] {
		return Document{}, adserrors.NoReceipt
	}
	amount := transaction.AmountMinor
	if amount < 0 {
		amount = -amount
	}
	bytes := reportingservices.BuildLabelledDocumentPdf("Payment receipt", [][2]string{
		{"Ad account", account.Name + " (" + account.ID.String() + ")"}, {"Reference", transaction.Reference}, {"Date", transaction.CreatedAt.UTC().Format(time.RFC3339)},
		{"Amount", services.FormatMinor(amount, transaction.Currency)}, {"Description", transaction.Description},
	})
	return Document{FileName: "receipt-" + unsafeFileCharacters.ReplaceAllString(transaction.Reference, "-") + ".pdf", Bytes: bytes}, nil
}
