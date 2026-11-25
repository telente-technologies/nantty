package developerproduction

import (
	"encoding/base64"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

const (
	defaultBusinessPageSize = 20
	maxBusinessPageSize     = 100
)

type BusinessApiCursor struct {
	Kind       string
	CreatedAt  time.Time
	ResourceID uuid.UUID
}

func EncodeBusinessApiCursor(cursor BusinessApiCursor) string {
	value := cursor.Kind + "|1|" + cursor.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + cursor.ResourceID.String()
	return base64.RawURLEncoding.EncodeToString([]byte(value))
}

func DecodeBusinessApiCursor(value string) (BusinessApiCursor, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil || len(decoded) > 192 {
		return BusinessApiCursor{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "The cursor is invalid.")
	}
	parts := strings.Split(string(decoded), "|")
	if len(parts) != 4 || (parts[0] != "conversation" && parts[0] != "message") || parts[1] != "1" {
		return BusinessApiCursor{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "The cursor is invalid.")
	}
	createdAt, err := time.Parse(time.RFC3339Nano, parts[2])
	if err != nil {
		return BusinessApiCursor{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "The cursor is invalid.")
	}
	resourceID, err := uuid.Parse(parts[3])
	if err != nil {
		return BusinessApiCursor{}, httpserver.NewApiError(http.StatusBadRequest, "INVALID_CURSOR", "The cursor is invalid.")
	}
	return BusinessApiCursor{Kind: parts[0], CreatedAt: createdAt.UTC(), ResourceID: resourceID}, nil
}

func ParseBusinessPageSize(query url.Values) (int, error) {
	value := query.Get("limit")
	if value == "" {
		return defaultBusinessPageSize, nil
	}
	limit, err := strconv.Atoi(value)
	if err != nil || limit < 1 || limit > maxBusinessPageSize {
		return 0, httpserver.NewApiError(http.StatusBadRequest, "INVALID_LIMIT", "limit must be an integer between 1 and 100.")
	}
	return limit, nil
}
