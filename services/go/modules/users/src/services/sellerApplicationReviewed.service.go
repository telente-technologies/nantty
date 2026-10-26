package services

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	platformevents "nantty/platform/events"
	"nantty/platform/identityports"
)

const SellerApplicationReviewedEventType = "sellerApplication.reviewed"

func GrantSellerRoleOnApproval(ctx context.Context, data json.RawMessage) error {
	var reviewed struct {
		AccountId string `json:"accountId"`
		Decision  string `json:"decision"`
	}
	if err := json.Unmarshal(data, &reviewed); err != nil {
		return fmt.Errorf("%w: seller application: %v", platformevents.ErrPoisonMessage, err)
	}
	if reviewed.Decision != "approved" {
		return nil
	}
	accountId, err := uuid.Parse(reviewed.AccountId)
	if err != nil {
		return fmt.Errorf("%w: seller application account id: %v", platformevents.ErrPoisonMessage, err)
	}
	enforcement, err := identityports.Default.AccountEnforcement()
	if err != nil {
		return err
	}
	return enforcement.SetAccountRole(ctx, accountId, "seller", true)
}
