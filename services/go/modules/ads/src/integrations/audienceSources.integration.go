package integrations

import (
	"context"
	"database/sql"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	adserrors "zudomart/modules/ads/src/errors"
)

type UnavailableAudienceSource struct{}

func (UnavailableAudienceSource) StoreCustomers(context.Context, string, int, int) ([]string, error) {
	return nil, adserrors.UpstreamUnavailable
}

func (UnavailableAudienceSource) Engagers(context.Context, string, string, int) ([]string, error) {
	return nil, adserrors.UpstreamUnavailable
}

func (UnavailableAudienceSource) Followers(context.Context, string) ([]string, error) {
	return nil, adserrors.UpstreamUnavailable
}

type AuthSchemaIdentityMatcher struct {
	Database *sql.DB
	Schema   string
}

func (matcher AuthSchemaIdentityMatcher) MatchEmailHashes(ctx context.Context, hashes []string) ([]string, error) {
	matched := make([]string, 0)
	for start := 0; start < len(hashes); start += 5000 {
		chunk := hashes[start:min(start+5000, len(hashes))]
		placeholders, arguments := make([]string, len(chunk)), make([]any, len(chunk))
		for index, hash := range chunk {
			placeholders[index], arguments[index] = "$"+strconv.Itoa(index+1), hash
		}
		query := `SELECT id FROM ` + pgx.Identifier{matcher.Schema, "accounts"}.Sanitize() +
			` WHERE status = 'active' AND email IS NOT NULL AND encode(sha256(convert_to(lower(trim(email)), 'UTF8')), 'hex') IN (` + strings.Join(placeholders, ",") + `)`
		rows, err := matcher.Database.QueryContext(ctx, query, arguments...)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				_ = rows.Close()
				return nil, err
			}
			matched = append(matched, id)
		}
		if err := rows.Close(); err != nil {
			return nil, err
		}
	}
	return matched, nil
}

func (AuthSchemaIdentityMatcher) MatchPhoneHashes(context.Context, []string) ([]string, error) {
	return nil, adserrors.PhoneMatchingUnavailable
}
