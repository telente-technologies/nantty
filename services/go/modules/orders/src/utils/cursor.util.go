package utils

import (
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

var errInvalidCursor = httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "The cursor is not valid.")

func EncodeCursor(parts ...string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strings.Join(parts, "|")))
}

func DecodeCursor(raw string, expectedParts int) ([]string, error) {
	if raw == "" {
		return nil, nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return nil, errInvalidCursor
	}
	parts := strings.Split(string(decoded), "|")
	if len(parts) != expectedParts {
		return nil, errInvalidCursor
	}
	return parts, nil
}

func DecodeIdentifierCursor(raw string) (*uuid.UUID, error) {
	parts, err := DecodeCursor(raw, 1)
	if err != nil || parts == nil {
		return nil, err
	}
	identifier, parseError := uuid.Parse(parts[0])
	if parseError != nil {
		return nil, errInvalidCursor
	}
	return &identifier, nil
}

func PageFromOverfetchedRows[Row any, Item any](rows []Row, limit int, toItem func(Row) Item, cursorOf func(Row) string) httpserver.CursorPage[Item] {
	nextCursor := ""
	if len(rows) > limit {
		rows = rows[:limit]
		nextCursor = cursorOf(rows[limit-1])
	}
	items := make([]Item, 0, len(rows))
	for _, row := range rows {
		items = append(items, toItem(row))
	}
	return httpserver.NewCursorPage(items, nextCursor)
}

func IdentifierCursor(identifier uuid.UUID) string { return EncodeCursor(identifier.String()) }
