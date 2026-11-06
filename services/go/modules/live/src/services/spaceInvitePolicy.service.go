package services

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/modules/live/src/generated/ent"
)

const spaceAudienceMetadataKey = "spaceAudiencePolicy"
const inviteOnlySpacePolicy = "invite_only"

func IsInviteOnlySpace(row *ent.Space) bool {
	if row == nil || row.Metadata == nil {
		return false
	}
	policy, _ := row.Metadata[spaceAudienceMetadataKey].(string)
	return policy == inviteOnlySpacePolicy
}

func SpaceHasInvite(row *ent.Space, accountID uuid.UUID) bool {
	if row == nil || accountID == uuid.Nil {
		return false
	}
	if row.HostID == accountID {
		return true
	}
	if row.Metadata == nil {
		return false
	}
	// Once the accepted list exists, pending invitations must not grant access.
	// The migration seeds it from the legacy list to preserve old invitations.
	invited, ok := row.Metadata["acceptedSpaceInviteAccountIds"]
	if !ok {
		invited = row.Metadata["invitedAccountIds"]
	}
	if invited == nil {
		return false
	}
	_, ok = row.Metadata["invitedAccountIds"]
	if !ok {
		if _, legacy := row.Metadata["acceptedSpaceInviteAccountIds"]; !legacy {
			return false
		}
	}
	switch values := invited.(type) {
	case []string:
		for _, value := range values {
			if value == accountID.String() {
				return true
			}
		}
	case []any:
		for _, value := range values {
			if text, ok := value.(string); ok && text == accountID.String() {
				return true
			}
		}
	}
	return false
}

type SpaceInvitation struct {
	ID          string `json:"id"`
	AccountID   string `json:"accountId"`
	Role        string `json:"role"`
	Title       string `json:"title,omitempty"`
	Status      string `json:"status"`
	InvitedAt   string `json:"invitedAt"`
	RespondedAt string `json:"respondedAt,omitempty"`
}

func SpaceInvitations(row *ent.Space) []SpaceInvitation {
	if row == nil || row.Metadata == nil {
		return nil
	}
	var rawEntries []map[string]any
	switch raw := row.Metadata["spaceInvitations"].(type) {
	case []map[string]any:
		rawEntries = raw
	case []any:
		for _, value := range raw {
			if entry, ok := value.(map[string]any); ok {
				rawEntries = append(rawEntries, entry)
			}
		}
	default:
		return nil
	}
	items := make([]SpaceInvitation, 0, len(rawEntries))
	for _, entry := range rawEntries {
		invitation := SpaceInvitation{}
		invitation.ID, _ = entry["id"].(string)
		invitation.AccountID, _ = entry["accountId"].(string)
		invitation.Role, _ = entry["role"].(string)
		invitation.Title, _ = entry["title"].(string)
		invitation.Status, _ = entry["status"].(string)
		invitation.InvitedAt, _ = entry["invitedAt"].(string)
		invitation.RespondedAt, _ = entry["respondedAt"].(string)
		items = append(items, invitation)
	}
	return items
}

func AddSpaceInvitation(row *ent.Space, accountID uuid.UUID, role, title string, now time.Time) (map[string]any, SpaceInvitation, bool) {
	metadata := cloneSpaceMetadata(row.Metadata)
	metadata["acceptedSpaceInviteAccountIds"] = stringIdentifiers(metadata["acceptedSpaceInviteAccountIds"])
	invitation := SpaceInvitation{AccountID: accountID.String(), Role: role, Title: title, Status: "pending", InvitedAt: now.UTC().Format(time.RFC3339Nano)}
	items := SpaceInvitations(row)
	for i, existing := range items {
		if existing.AccountID != accountID.String() {
			continue
		}
		if existing.Status == "pending" && existing.Role == role && existing.Title == title {
			return metadata, existing, false
		}
		if existing.Status == "accepted" {
			return metadata, existing, false
		}
		invitation.ID = uuid.NewString()
		items[i] = invitation
		metadata["spaceInvitations"] = invitationMaps(items)
		metadata["invitedAccountIds"] = appendIdentifier(metadata["invitedAccountIds"], accountID.String())
		return metadata, invitation, true
	}
	invitation.ID = uuid.NewString()
	items = append(items, invitation)
	metadata["spaceInvitations"] = invitationMaps(items)
	metadata["invitedAccountIds"] = appendIdentifier(metadata["invitedAccountIds"], accountID.String())
	return metadata, invitation, true
}

func RespondToSpaceInvitation(row *ent.Space, invitationID, accountID uuid.UUID, accepted bool, now time.Time) (map[string]any, SpaceInvitation, bool, error) {
	metadata := cloneSpaceMetadata(row.Metadata)
	items := SpaceInvitations(row)
	for i, invitation := range items {
		if invitation.ID != invitationID.String() || invitation.AccountID != accountID.String() {
			continue
		}
		if invitation.Status == "accepted" && accepted || invitation.Status == "declined" && !accepted {
			return metadata, invitation, false, nil
		}
		if invitation.Status != "pending" {
			return nil, invitation, false, fmt.Errorf("SPACE_INVITATION_CLOSED")
		}
		if accepted {
			invitation.Status = "accepted"
		} else {
			invitation.Status = "declined"
		}
		invitation.RespondedAt = now.UTC().Format(time.RFC3339Nano)
		items[i] = invitation
		metadata["spaceInvitations"] = invitationMaps(items)
		if accepted {
			metadata["acceptedSpaceInviteAccountIds"] = appendIdentifier(metadata["acceptedSpaceInviteAccountIds"], accountID.String())
		}
		return metadata, invitation, true, nil
	}
	return nil, SpaceInvitation{}, false, fmt.Errorf("SPACE_INVITATION_NOT_FOUND")
}

func AcceptedSpaceInvitation(row *ent.Space, accountID uuid.UUID) (SpaceInvitation, bool) {
	for _, invitation := range SpaceInvitations(row) {
		if invitation.AccountID == accountID.String() && invitation.Status == "accepted" {
			return invitation, true
		}
	}
	// Legacy invitations carry no explicit role and remain listener invitations.
	if SpaceHasInvite(row, accountID) {
		return SpaceInvitation{AccountID: accountID.String(), Role: "listener", Status: "accepted"}, true
	}
	return SpaceInvitation{}, false
}

func cloneSpaceMetadata(source map[string]any) map[string]any {
	metadata := make(map[string]any, len(source)+3)
	for key, value := range source {
		metadata[key] = value
	}
	return metadata
}

func stringIdentifiers(raw any) []string {
	values := make([]string, 0)
	switch typed := raw.(type) {
	case []string:
		values = append(values, typed...)
	case []any:
		for _, value := range typed {
			if text, ok := value.(string); ok {
				values = append(values, text)
			}
		}
	}
	return values
}

func appendIdentifier(raw any, value string) []string {
	values := stringIdentifiers(raw)
	for _, current := range values {
		if current == value {
			return values
		}
	}
	return append(values, value)
}

func invitationMaps(items []SpaceInvitation) []map[string]any {
	result := make([]map[string]any, 0, len(items))
	for _, item := range items {
		entry := map[string]any{"id": item.ID, "accountId": item.AccountID, "role": item.Role, "status": item.Status, "invitedAt": item.InvitedAt}
		if strings.TrimSpace(item.Title) != "" {
			entry["title"] = item.Title
		}
		if item.RespondedAt != "" {
			entry["respondedAt"] = item.RespondedAt
		}
		result = append(result, entry)
	}
	return result
}

func AddSpaceInvite(row *ent.Space, accountID uuid.UUID) map[string]any {
	metadata := make(map[string]any, len(row.Metadata)+2)
	for key, value := range row.Metadata {
		metadata[key] = value
	}
	metadata[spaceAudienceMetadataKey] = inviteOnlySpacePolicy
	values := make([]string, 0)
	if current, ok := metadata["invitedAccountIds"].([]string); ok {
		values = append(values, current...)
	} else if current, ok := metadata["invitedAccountIds"].([]any); ok {
		for _, value := range current {
			if text, ok := value.(string); ok {
				values = append(values, text)
			}
		}
	}
	for _, value := range values {
		if value == accountID.String() {
			metadata["invitedAccountIds"] = values
			return metadata
		}
	}
	metadata["invitedAccountIds"] = append(values, accountID.String())
	return metadata
}
