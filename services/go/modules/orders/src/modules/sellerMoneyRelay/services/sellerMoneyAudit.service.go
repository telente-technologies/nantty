package services

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"zudomart/modules/orders/src/container"
	"zudomart/platform/commerceports"
	"zudomart/platform/money"
)

type relayedPayout struct {
	Id        string      `json:"id"`
	Amount    money.Money `json:"amount"`
	AccountId string      `json:"accountId"`
}

func RecordSellerMoneyAudit(ctx context.Context, deployed *container.Container, request *http.Request, store commerceports.StoreAccess, actorId uuid.UUID, action, targetType string, responseBody []byte) {
	trail, err := commerceports.Default.StoreAuditTrail()
	if err != nil {
		return
	}
	var parsed relayedPayout
	_ = json.Unmarshal(responseBody, &parsed)
	summary := map[string]string{
		"payout.requested":        "Requested a payout of " + parsed.Amount.String(),
		"payout_account.added":    "Added a payout account",
		"payout_account.updated":  "Changed the default payout account",
		"payout_account.removed":  "Removed a payout account",
		"payout_schedule.updated": "Changed the payout schedule",
	}[action]
	name := ""
	if profiles, lookupError := deployed.Users.PersonalProfilesByAccount(ctx, []uuid.UUID{actorId}); lookupError == nil {
		name = profiles[actorId].Name
	}
	targetId := parsed.Id
	if targetId == "" {
		targetId = request.PathValue("accountId")
	}
	record := commerceports.StoreAuditRecord{StoreId: store.StoreId, ActorId: actorId.String(), ActorName: name, ActorRole: store.Role, Action: action,
		TargetType: targetType, TargetId: targetId, Summary: summary, IpAddress: clientAddress(request)}
	if err := trail.RecordStoreAudit(ctx, record); err != nil {
		deployed.Logger.WarnContext(ctx, "store audit entry was not written", "action", action, "error", err)
	}
}

func clientAddress(request *http.Request) string {
	for _, header := range []string{"X-Real-Ip", "X-Forwarded-For"} {
		if value := strings.TrimSpace(strings.Split(request.Header.Get(header), ",")[0]); net.ParseIP(value) != nil {
			return value
		}
	}
	return ""
}
