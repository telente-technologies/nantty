package services

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"nantty/modules/creators/src/generated/ent"
	"nantty/modules/creators/src/generated/ent/creatorearning"
)

const CoinUnit = "COIN"

type Earning struct {
	CreatorId   string
	Kind        creatorearning.Kind
	Reference   string
	SourceType  string
	SourceId    string
	Description string
	GrossMinor  int64
	NetMinor    int64
	Unit        string
	Status      creatorearning.Status
	AvailableAt *time.Time
	At          time.Time
}

func RecordEarning(ctx context.Context, client *ent.Client, earning Earning) (bool, error) {
	if earning.Status == "" {
		earning.Status = creatorearning.StatusAvailable
	}
	create := client.CreatorEarning.Create().SetCreatorID(earning.CreatorId).SetKind(earning.Kind).SetReference(earning.Reference).SetSourceType(earning.SourceType).
		SetSourceID(earning.SourceId).SetDescription(truncate(earning.Description, 200)).SetGrossMinor(earning.GrossMinor).SetNetMinor(earning.NetMinor).
		SetUnit(earning.Unit).SetStatus(earning.Status).SetNillableAvailableAt(earning.AvailableAt).SetCreatedAt(earning.At)
	err := create.OnConflictColumns(creatorearning.FieldReference).DoNothing().Exec(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func truncate(value string, maximum int) string {
	if len(value) > maximum {
		return value[:maximum]
	}
	return value
}
