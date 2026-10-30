package services

import (
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
	invited, ok := row.Metadata["invitedAccountIds"]
	if !ok {
		return false
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
