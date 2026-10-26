package integrations

import (
	"context"
	"database/sql"

	"github.com/jackc/pgx/v5"

	"nantty/modules/ads/src/interfaces"
)

type SchemaPromotedDestinations struct {
	Database      *sql.DB
	UsersSchema   string
	CatalogSchema string
	AuthSchema    string
}

func (directory SchemaPromotedDestinations) table(schema, name string) string {
	return pgx.Identifier{schema, name}.Sanitize()
}

func (directory SchemaPromotedDestinations) profileQuery(filter string) string {
	return `SELECT p.account_id::text, COALESCE(NULLIF(p.display_name, ''), p.handle), p.handle, p.avatar_url, p.verified, COALESCE(c.color, ''), p.is_private,
		p.status = 'active' AND COALESCE(a.status, 'active') = 'active'
		AND NOT EXISTS (SELECT 1 FROM ` + directory.table(directory.UsersSchema, "account_suspensions") + ` s WHERE s.account_id = p.account_id AND s.status = 'active')
		AND NOT EXISTS (SELECT 1 FROM ` + directory.table(directory.UsersSchema, "account_bans") + ` b WHERE b.account_id = p.account_id AND b.lifted_at IS NULL AND (b.ends_at IS NULL OR b.ends_at > now()))
		FROM ` + directory.table(directory.UsersSchema, "profiles") + ` p
		LEFT JOIN ` + directory.table(directory.UsersSchema, "profile_checkmarks") + ` c ON c.profile_id = p.id AND c.status IN ('verified', 'grace')
		LEFT JOIN ` + directory.table(directory.AuthSchema, "accounts") + ` a ON a.id = p.account_id
		WHERE p.kind = 'personal' AND ` + filter
}

func (directory SchemaPromotedDestinations) storeQuery(filter string) string {
	return `SELECT id::text, name, slug, logo_url, verified, '', false, status = 'active' FROM ` + directory.table(directory.CatalogSchema, "stores") + ` WHERE channel = 'store' AND ` + filter
}

func (directory SchemaPromotedDestinations) query(kind, filter string) (string, bool) {
	switch kind {
	case "profile":
		return directory.profileQuery(filter), directory.UsersSchema != ""
	case "store":
		return directory.storeQuery(filter), directory.CatalogSchema != ""
	}
	return "", false
}

func (directory SchemaPromotedDestinations) scan(ctx context.Context, kind, statement string, arguments ...any) ([]interfaces.PromotedDestination, error) {
	rows, err := directory.Database.QueryContext(ctx, statement, arguments...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	found := []interfaces.PromotedDestination{}
	for rows.Next() {
		destination := interfaces.PromotedDestination{Kind: kind}
		var avatar sql.NullString
		if err := rows.Scan(&destination.Id, &destination.Name, &destination.Handle, &avatar, &destination.Verified, &destination.CheckmarkColor, &destination.Private, &destination.Available); err != nil {
			return nil, err
		}
		if avatar.Valid && avatar.String != "" {
			destination.AvatarUrl = &avatar.String
		}
		found = append(found, destination)
	}
	return found, rows.Err()
}

func (directory SchemaPromotedDestinations) LookupDestinations(ctx context.Context, kind string, ids []string) (map[string]interfaces.PromotedDestination, error) {
	byId := map[string]interfaces.PromotedDestination{}
	filterColumn := map[string]string{"profile": "p.account_id::text", "store": "id::text"}[kind]
	statement, configured := directory.query(kind, filterColumn+" = ANY($1)")
	if len(ids) == 0 || !configured || directory.Database == nil {
		return byId, nil
	}
	found, err := directory.scan(ctx, kind, statement, ids)
	if err != nil {
		return nil, err
	}
	for _, destination := range found {
		byId[destination.Id] = destination
	}
	return byId, nil
}

func (directory SchemaPromotedDestinations) ListPromotableDestinations(ctx context.Context, kind, ownerUserId string) ([]interfaces.PromotedDestination, error) {
	filterColumn := map[string]string{"profile": "p.account_id::text", "store": "owner_account_id::text"}[kind]
	statement, configured := directory.query(kind, filterColumn+" = $1")
	if !configured || directory.Database == nil {
		return []interfaces.PromotedDestination{}, nil
	}
	return directory.scan(ctx, kind, statement+" LIMIT 20", ownerUserId)
}

type StaticPromotedDestinations struct {
	Destinations []interfaces.PromotedDestination
	Owners       map[string]string
}

func (directory StaticPromotedDestinations) LookupDestinations(_ context.Context, kind string, ids []string) (map[string]interfaces.PromotedDestination, error) {
	byId := map[string]interfaces.PromotedDestination{}
	for _, destination := range directory.Destinations {
		for _, id := range ids {
			if destination.Kind == kind && destination.Id == id {
				byId[id] = destination
			}
		}
	}
	return byId, nil
}

func (directory StaticPromotedDestinations) ListPromotableDestinations(_ context.Context, kind, ownerUserId string) ([]interfaces.PromotedDestination, error) {
	listed := []interfaces.PromotedDestination{}
	for _, destination := range directory.Destinations {
		if destination.Kind == kind && directory.Owners[destination.Kind+":"+destination.Id] == ownerUserId {
			listed = append(listed, destination)
		}
	}
	return listed, nil
}
