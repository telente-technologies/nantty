package respondtoipclaim

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/moderation/src/container"
	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/ipclaim"
	"zudomart/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, sellerId, claimId, statement string) error {
	seller, sellerErr := uuid.Parse(sellerId)
	identifier, claimErr := uuid.Parse(claimId)
	if sellerErr != nil {
		return httpserver.ErrUnauthorized
	}
	statement = strings.TrimSpace(statement)
	if statement == "" || len(statement) > 2000 {
		return httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "statement", Message: "is required, at most 2000 characters"}})
	}
	if claimErr != nil {
		return httpserver.ErrNotFound
	}
	claim, err := handler.Container.Client.IpClaim.Get(ctx, identifier)
	if ent.IsNotFound(err) || (err == nil && claim.AccusedSellerID != seller) {
		return httpserver.ErrNotFound
	}
	if err != nil {
		return err
	}
	if claim.Status != ipclaim.StatusOpen && claim.Status != ipclaim.StatusNeedsInfo {
		return httpserver.NewApiError(http.StatusConflict, "INVALID_CLAIM_TRANSITION", "This claim was already decided.")
	}
	encoded, _ := json.Marshal(map[string]string{"submittedAt": handler.Container.Now().UTC().Format(time.RFC3339), "statement": statement})
	return handler.Container.Client.IpClaim.UpdateOne(claim).SetSellerResponse(encoded).Exec(ctx)
}
