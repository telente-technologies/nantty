package repositories

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"zudomart/modules/moderation/src/generated/ent"
	"zudomart/modules/moderation/src/generated/ent/automationrule"
	"zudomart/modules/moderation/src/generated/ent/automationruleversion"
	"zudomart/modules/moderation/src/modules/automationRules/dtos"
	"zudomart/modules/moderation/src/modules/automationRules/services"
	"zudomart/platform/httpserver"
	"zudomart/platform/staffauth"
)

var (
	ErrRuleNotFound    = httpserver.NewApiError(http.StatusNotFound, "NOT_FOUND", "Configuration record not found.")
	ErrVersionNotFound = httpserver.NewApiError(http.StatusNotFound, "NOT_FOUND", "Version not found.")
)

type VersionWrite struct {
	RuleId          string
	ExpectedVersion int
	Reason          string
	Content         services.RuleContent
	Archived        bool
	Staff           staffauth.Staff
	Now             time.Time
}

func RecordFromVersion(row *ent.AutomationRuleVersion) dtos.VersionedRecord {
	var content services.RuleContent
	_ = json.Unmarshal(row.Content, &content)
	return dtos.VersionedRecord{
		Id: row.RuleID, Version: row.Version, UpdatedAt: row.CreatedAt.UTC().Format(time.RFC3339), UpdatedBy: dtos.VersionAuthor{Id: row.UpdatedByID, Name: row.UpdatedByName},
		ChangeReason: row.ChangeReason, IsArchived: row.IsArchived, Content: content,
	}
}

func RecordFromRule(row *ent.AutomationRule) dtos.VersionedRecord {
	var content services.RuleContent
	_ = json.Unmarshal(row.Content, &content)
	return dtos.VersionedRecord{
		Id: row.ID, Version: row.Version, UpdatedAt: row.UpdatedAt.UTC().Format(time.RFC3339), UpdatedBy: dtos.VersionAuthor{Id: row.UpdatedByID, Name: row.UpdatedByName},
		ChangeReason: row.ChangeReason, IsArchived: row.IsArchived, Content: content,
	}
}

func LockCurrent(ctx context.Context, tx *ent.Tx, ruleId string) (*ent.AutomationRule, error) {
	row, err := tx.AutomationRule.Query().Where(automationrule.ID(ruleId)).ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return row, err
}

func FindVersion(ctx context.Context, tx *ent.Tx, ruleId string, version int) (*ent.AutomationRuleVersion, error) {
	row, err := tx.AutomationRuleVersion.Query().Where(automationruleversion.RuleID(ruleId), automationruleversion.Version(version)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, ErrVersionNotFound
	}
	return row, err
}

func AppendVersion(ctx context.Context, tx *ent.Tx, current *ent.AutomationRule, write VersionWrite) (dtos.VersionedRecord, error) {
	currentVersion := 0
	if current != nil {
		currentVersion = current.Version
	}
	recreating := current != nil && current.IsArchived && write.ExpectedVersion == 0
	if write.ExpectedVersion != currentVersion && !recreating {
		return dtos.VersionedRecord{}, httpserver.NewApiError(http.StatusConflict, "VERSION_CONFLICT", fmt.Sprintf("Someone saved version %d after you started editing. Reload to see their changes, then apply yours again.", currentVersion))
	}
	encoded, err := json.Marshal(write.Content)
	if err != nil {
		return dtos.VersionedRecord{}, err
	}
	version := currentVersion + 1
	enabled := write.Content.IsEnabled && !write.Archived
	if current == nil {
		err = tx.AutomationRule.Create().SetID(write.RuleId).SetVersion(version).SetEvent(write.Content.Event).SetIsEnabled(enabled).SetIsArchived(write.Archived).SetContent(encoded).
			SetChangeReason(write.Reason).SetUpdatedByID(write.Staff.Id).SetUpdatedByName(write.Staff.Name).SetCreatedAt(write.Now).SetUpdatedAt(write.Now).Exec(ctx)
	} else {
		err = tx.AutomationRule.UpdateOne(current).SetVersion(version).SetEvent(write.Content.Event).SetIsEnabled(enabled).SetIsArchived(write.Archived).SetContent(encoded).
			SetChangeReason(write.Reason).SetUpdatedByID(write.Staff.Id).SetUpdatedByName(write.Staff.Name).SetUpdatedAt(write.Now).Exec(ctx)
	}
	if err != nil {
		return dtos.VersionedRecord{}, err
	}
	row, err := tx.AutomationRuleVersion.Create().SetRuleID(write.RuleId).SetVersion(version).SetContent(encoded).SetChangeReason(write.Reason).SetUpdatedByID(write.Staff.Id).
		SetUpdatedByName(write.Staff.Name).SetIsArchived(write.Archived).SetCreatedAt(write.Now).Save(ctx)
	if err != nil {
		return dtos.VersionedRecord{}, err
	}
	return RecordFromVersion(row), nil
}
