package exportfinancereport

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/modules/financeReports/models"
	getfinanceoverview "nantty/modules/admin/src/modules/financeReports/queries/getFinanceOverview"
	getmoneybyaspect "nantty/modules/admin/src/modules/financeReports/queries/getMoneyByAspect"
	listescrows "nantty/modules/admin/src/modules/financeReports/queries/listEscrows"
	listfinanceissues "nantty/modules/admin/src/modules/financeReports/queries/listFinanceIssues"
	"nantty/modules/admin/src/repositories"
	jsonencoding "nantty/modules/admin/src/utils/jsonEncoding"
	"nantty/platform/identityports"
	"nantty/platform/staffauth"
)

type Handler struct {
	Container *container.Container
}

func NeutralizeCsvCell(cell string) string {
	first := strings.TrimLeftFunc(cell, unicode.IsSpace)
	if first != "" && strings.ContainsRune("=+-@", []rune(first)[0]) {
		return "'" + cell
	}
	return cell
}

func (handler Handler) Execute(ctx context.Context, actor staffauth.Staff, req models.ExportRequest) (string, []byte, error) {
	reason := strings.TrimSpace(req.Reason)
	reasonLength := utf8.RuneCountInString(reason)
	if reasonLength < 5 || reasonLength > 500 {
		return "", nil, adminerrors.ValidationFailedFor("reason", "must be between 5 and 500 characters")
	}
	reportType := strings.TrimSpace(req.ReportType)
	if reportType == "" {
		reportType = "overview"
	}
	rangeName := req.Range
	if rangeName == "" {
		rangeName = "7d"
	}

	var rows [][]string
	switch reportType {
	case "overview":
		overview, err := getfinanceoverview.Handler{Container: handler.Container}.Execute(ctx, getfinanceoverview.Query{Range: rangeName, Currency: req.Currency})
		if err != nil {
			return "", nil, err
		}
		rows = append(rows, []string{"metric", "currency", "amountMinor", "count"})
		appendMoney := func(metric string, items []models.Money) {
			for _, item := range items {
				rows = append(rows, []string{metric, item.Currency, fmt.Sprintf("%d", item.AmountMinor), ""})
			}
		}
		appendMoney("gmv", overview.GmvByCurrency)
		appendMoney("escrow_held", overview.EscrowHeldByCurrency)
		appendMoney("escrow_released", overview.EscrowReleasedByCurrency)
		appendMoney("escrow_refunded", overview.EscrowRefundedByCurrency)
		appendMoney("payouts_pending", overview.PayoutsPendingByCurrency)
		appendMoney("coin_sales", overview.CoinSalesByCurrency)
		appendMoney("ad_top_ups", overview.AdTopUpsByCurrency)
		appendMoney("subscriptions", overview.SubscriptionByCurrency)
		appendMoney("platform_revenue", overview.PlatformRevenueByCurrency)
		rows = append(rows, []string{"stuck_escrows", "", "", fmt.Sprintf("%d", overview.StuckEscrowsCount)})
		rows = append(rows, []string{"disputes_open", "", "", fmt.Sprintf("%d", overview.DisputesOpenCount)})
		rows = append(rows, []string{"payouts_aged_processing", "", "", fmt.Sprintf("%d", overview.PayoutsAgedCount)})
		rows = append(rows, []string{"seller_debt_accounts", "", "", fmt.Sprintf("%d", overview.SellerDebtAccountsCount)})
	case "escrow_held", "stuck_escrows":
		escrows, err := listescrows.Handler{Container: handler.Container}.Execute(ctx, listescrows.Query{StuckOnly: reportType == "stuck_escrows", Currency: req.Currency, Limit: 100})
		if err != nil {
			return "", nil, err
		}
		rows = append(rows, []string{"escrowId", "orderId", "status", "currency", "amountMinor", "autoReleaseAt", "deliveredAt", "stuck"})
		for _, item := range escrows.Data {
			rows = append(rows, []string{item.Id, item.OrderId, item.Status, item.Amount.Currency, fmt.Sprintf("%d", item.Amount.AmountMinor), strPtr(item.AutoReleaseAt), strPtr(item.DeliveredAt), fmt.Sprintf("%t", item.Stuck)})
		}
	case "money_by_aspect":
		aspect, err := getmoneybyaspect.Handler{Container: handler.Container}.Execute(ctx, getmoneybyaspect.Query{Aspect: "all", Range: rangeName, Currency: req.Currency})
		if err != nil {
			return "", nil, err
		}
		rows = append(rows, []string{"group", "status", "currency", "count", "amountMinor"})
		for _, item := range aspect.Breakdown {
			rows = append(rows, []string{item.Group, item.Status, item.Currency, fmt.Sprintf("%d", item.Count), fmt.Sprintf("%d", item.AmountMinor)})
		}
	case "issues":
		issues, err := listfinanceissues.Handler{Container: handler.Container}.Execute(ctx, listfinanceissues.Query{Limit: 100})
		if err != nil {
			return "", nil, err
		}
		rows = append(rows, []string{"id", "queue", "severity", "entityType", "entityId", "reference", "currency", "amountMinor", "summary"})
		for _, item := range issues.Data {
			cur, amt := "", ""
			if item.Amount != nil {
				cur, amt = item.Amount.Currency, fmt.Sprintf("%d", item.Amount.AmountMinor)
			}
			rows = append(rows, []string{item.Id, item.Queue, item.Severity, item.EntityType, item.EntityId, item.Reference, cur, amt, item.Summary})
		}
	default:
		return "", nil, adminerrors.ValidationFailedFor("reportType", "must be overview, escrow_held, stuck_escrows, money_by_aspect, or issues")
	}

	if err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: actor.Id, ActorName: actor.Name, ActorRole: actor.Role, Action: "finance.report.exported",
			SubjectType: "finance_report", SubjectId: reportType, Reason: strings.TrimSpace(req.Reason), StepUpVerified: true,
			After: jsonencoding.MustMarshalJson(map[string]any{"reportType": reportType, "range": rangeName, "currency": req.Currency, "rows": max(len(rows)-1, 0)}),
		})
	}); err != nil {
		return "", nil, err
	}

	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)
	for _, row := range rows {
		safe := make([]string, len(row))
		for index, cell := range row {
			safe[index] = NeutralizeCsvCell(cell)
		}
		if err := writer.Write(safe); err != nil {
			return "", nil, err
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return "", nil, err
	}
	return fmt.Sprintf("finance-%s-%s.csv", reportType, rangeName), buffer.Bytes(), nil
}

func strPtr(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
