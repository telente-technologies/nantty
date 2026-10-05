package repositories

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type CreatorAccount struct {
	AccountId   string
	Approved    bool
	CountryCode string
}

type UserSummary struct {
	Id        string `json:"id"`
	Username  string `json:"username"`
	Name      string `json:"name"`
	AvatarUrl any    `json:"avatarUrl"`
	Verified  bool   `json:"verified"`
}

type CreatorDirectory interface {
	FindCreator(ctx context.Context, creatorId string) (CreatorAccount, bool, error)
	BlockedEitherWay(ctx context.Context, firstUserId, secondUserId string) (bool, error)
	FindUserSummaries(ctx context.Context, accountIds []string) (map[string]UserSummary, error)
}

type SqlCreatorDirectory struct {
	Database        *sql.DB
	UsersSchema     string
	CreatorsSchema  string
	SocialSchema    string
	TolerateMissing bool
}

func (directory SqlCreatorDirectory) unreadable(err error) bool {
	var pgError *pgconn.PgError
	return directory.TolerateMissing && errors.As(err, &pgError) && (pgError.Code == "42P01" || pgError.Code == "42501" || pgError.Code == "3F000")
}

func (directory SqlCreatorDirectory) FindCreator(ctx context.Context, creatorId string) (CreatorAccount, bool, error) {
	query := "SELECT p.account_id::text, COALESCE(p.country_code, ''), EXISTS (SELECT 1 FROM " + pgx.Identifier{directory.CreatorsSchema, "creator_program_members"}.Sanitize() +
		" m WHERE m.user_id = p.account_id::text AND m.status = 'approved') FROM " + pgx.Identifier{directory.UsersSchema, "profiles"}.Sanitize() +
		" p WHERE (p.account_id::text = $1 OR p.id::text = $1) AND p.kind = 'personal' AND p.status = 'active' LIMIT 1"
	var account CreatorAccount
	err := directory.Database.QueryRowContext(ctx, query, creatorId).Scan(&account.AccountId, &account.CountryCode, &account.Approved)
	if errors.Is(err, sql.ErrNoRows) {
		return CreatorAccount{}, false, nil
	}
	return account, err == nil, err
}

func (directory SqlCreatorDirectory) BlockedEitherWay(ctx context.Context, firstUserId, secondUserId string) (bool, error) {
	query := `SELECT EXISTS (SELECT 1 FROM ` + pgx.Identifier{directory.SocialSchema, "blocks"}.Sanitize() +
		` WHERE ("blockerId"::text = $1 AND "blockedId"::text = $2) OR ("blockerId"::text = $2 AND "blockedId"::text = $1))`
	var blocked bool
	err := directory.Database.QueryRowContext(ctx, query, firstUserId, secondUserId).Scan(&blocked)
	if err != nil && directory.unreadable(err) {
		return false, nil
	}
	return blocked, err
}

func (directory SqlCreatorDirectory) FindUserSummaries(ctx context.Context, accountIds []string) (map[string]UserSummary, error) {
	summaries := map[string]UserSummary{}
	if len(accountIds) == 0 {
		return summaries, nil
	}
	placeholders, arguments := make([]string, len(accountIds)), make([]any, len(accountIds))
	for index, id := range accountIds {
		placeholders[index], arguments[index] = "$"+strconv.Itoa(index+1), id
	}
	query := "SELECT account_id::text, COALESCE(handle, ''), COALESCE(display_name, ''), avatar_url, verified FROM " + pgx.Identifier{directory.UsersSchema, "profiles"}.Sanitize() +
		" WHERE kind = 'personal' AND account_id::text IN (" + strings.Join(placeholders, ",") + ")"
	rows, err := directory.Database.QueryContext(ctx, query, arguments...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var summary UserSummary
		var avatar sql.NullString
		if err := rows.Scan(&summary.Id, &summary.Username, &summary.Name, &avatar, &summary.Verified); err != nil {
			return nil, err
		}
		if avatar.Valid {
			summary.AvatarUrl = avatar.String
		}
		summaries[summary.Id] = summary
	}
	return summaries, rows.Err()
}

type StaticCreatorDirectory struct {
	Creators map[string]CreatorAccount
	Blocks   map[[2]string]bool
	Users    map[string]UserSummary
}

func (directory StaticCreatorDirectory) FindCreator(_ context.Context, creatorId string) (CreatorAccount, bool, error) {
	account, found := directory.Creators[creatorId]
	return account, found, nil
}

func (directory StaticCreatorDirectory) BlockedEitherWay(_ context.Context, firstUserId, secondUserId string) (bool, error) {
	return directory.Blocks[[2]string{firstUserId, secondUserId}] || directory.Blocks[[2]string{secondUserId, firstUserId}], nil
}

func (directory StaticCreatorDirectory) FindUserSummaries(_ context.Context, accountIds []string) (map[string]UserSummary, error) {
	summaries := map[string]UserSummary{}
	for _, id := range accountIds {
		if summary, found := directory.Users[id]; found {
			summaries[id] = summary
		}
	}
	return summaries, nil
}
