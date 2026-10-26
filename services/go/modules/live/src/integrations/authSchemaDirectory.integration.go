package integrations

import (
	"context"
	"database/sql"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/live/src/interfaces"
)

type AuthSchemaDirectory struct {
	Database *sql.DB
	Schema   string
}

func (directory AuthSchemaDirectory) LookupParticipants(ctx context.Context, identifiers []uuid.UUID) (map[uuid.UUID]interfaces.Participant, error) {
	found := make(map[uuid.UUID]interfaces.Participant, len(identifiers))
	if len(identifiers) == 0 {
		return found, nil
	}
	placeholders := make([]string, len(identifiers))
	arguments := make([]any, len(identifiers))
	for index, identifier := range identifiers {
		placeholders[index] = "$" + strconv.Itoa(index+1)
		arguments[index] = identifier.String()
	}
	rows, err := directory.Database.QueryContext(ctx, `SELECT id, username, name FROM "`+directory.Schema+`"."accounts" WHERE id IN (`+strings.Join(placeholders, ",")+`)`, arguments...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var participant interfaces.Participant
		if err := rows.Scan(&participant.Id, &participant.Username, &participant.Name); err != nil {
			return nil, err
		}
		found[participant.Id] = participant
	}
	return found, rows.Err()
}
