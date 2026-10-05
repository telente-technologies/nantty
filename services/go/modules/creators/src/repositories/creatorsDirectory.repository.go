package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

var ErrTargetNotFound = errors.New("target not found")

type UserSummary struct {
	Id        string  `json:"id"`
	Username  string  `json:"username"`
	Name      string  `json:"name"`
	AvatarUrl *string `json:"avatarUrl"`
	Verified  bool    `json:"verified"`
}

type StoreSummary struct {
	Id          string  `json:"id"`
	Name        string  `json:"name"`
	LogoUrl     *string `json:"logoUrl"`
	OwnerUserId string  `json:"-"`
	Currency    string  `json:"-"`
	Active      bool    `json:"-"`
}

type ProductSummary struct {
	Id         string
	StoreId    string
	Name       string
	PriceMinor int64
	Currency   string
	Published  bool
}

type LiveSummary struct {
	Id, HostId, Title, State string
}

type CreatorsDirectory interface {
	ContentOwner(ctx context.Context, targetType, targetId string) (string, error)
	FindLive(ctx context.Context, liveId string) (LiveSummary, bool, error)
	BlockedEitherWay(ctx context.Context, firstUserId, secondUserId string) (bool, error)
	FindUserSummaries(ctx context.Context, accountIds []string) (map[string]UserSummary, error)
	FindStores(ctx context.Context, storeIds []string) (map[string]StoreSummary, error)
	FindOwnedStore(ctx context.Context, ownerUserId, storeId string) (StoreSummary, bool, error)
	FindProducts(ctx context.Context, productIds []string) (map[string]ProductSummary, error)
	ListStoreProducts(ctx context.Context, storeId, search string, limit int) ([]ProductSummary, error)
	FollowerCount(ctx context.Context, accountId string) (int64, error)
	ApplicationStatus(ctx context.Context, accountId string) (string, error)
}

type SqlCreatorsDirectory struct {
	Database        *sql.DB
	UsersSchema     string
	SocialSchema    string
	LiveSchema      string
	CatalogSchema   string
	SocialUrl       string
	SocialToken     string
	HttpClient      *http.Client
	TolerateMissing bool
}

func (directory SqlCreatorsDirectory) unreadable(err error) bool {
	var pgError *pgconn.PgError
	return directory.TolerateMissing && errors.As(err, &pgError) && (pgError.Code == "42P01" || pgError.Code == "42501" || pgError.Code == "3F000")
}

func (directory SqlCreatorsDirectory) table(schema, name string) string {
	return pgx.Identifier{schema, name}.Sanitize()
}

func placeholders(values []string) (string, []any) {
	marks, arguments := make([]string, len(values)), make([]any, len(values))
	for index, value := range values {
		marks[index], arguments[index] = "$"+strconv.Itoa(index+1), value
	}
	return strings.Join(marks, ","), arguments
}

func (directory SqlCreatorsDirectory) ContentOwner(ctx context.Context, targetType, targetId string) (string, error) {
	if targetType == "live" {
		live, found, err := directory.FindLive(ctx, targetId)
		if err != nil || !found {
			return "", errors.Join(err, ErrTargetNotFound)
		}
		return live.HostId, nil
	}
	if directory.SocialUrl == "" {
		return "", fmt.Errorf("SOCIAL_INTERNAL_URL is not configured")
	}
	endpoint := strings.TrimRight(directory.SocialUrl, "/") + "/api/v1/internal/moderation/targets/" + url.PathEscape(targetType) + "/" + url.PathEscape(targetId)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("X-Internal-Token", directory.SocialToken)
	client := directory.HttpClient
	if client == nil {
		client = &http.Client{Timeout: 3 * time.Second}
	}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return "", ErrTargetNotFound
	}
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("social target lookup responded %d", response.StatusCode)
	}
	var body struct {
		OwnerId string `json:"ownerId"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil || body.OwnerId == "" {
		return "", errors.Join(err, ErrTargetNotFound)
	}
	return body.OwnerId, nil
}

func (directory SqlCreatorsDirectory) FindLive(ctx context.Context, liveId string) (LiveSummary, bool, error) {
	var live LiveSummary
	err := directory.Database.QueryRowContext(ctx, "SELECT id::text, host_id::text, COALESCE(title, ''), state::text FROM "+directory.table(directory.LiveSchema, "live_sessions")+" WHERE id::text = $1", liveId).
		Scan(&live.Id, &live.HostId, &live.Title, &live.State)
	if errors.Is(err, sql.ErrNoRows) || (err != nil && directory.unreadable(err)) {
		return LiveSummary{}, false, nil
	}
	return live, err == nil, err
}

func (directory SqlCreatorsDirectory) BlockedEitherWay(ctx context.Context, firstUserId, secondUserId string) (bool, error) {
	var blocked bool
	err := directory.Database.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM `+directory.table(directory.SocialSchema, "blocks")+
		` WHERE ("blockerId"::text = $1 AND "blockedId"::text = $2) OR ("blockerId"::text = $2 AND "blockedId"::text = $1))`, firstUserId, secondUserId).Scan(&blocked)
	if err != nil && directory.unreadable(err) {
		return false, nil
	}
	return blocked, err
}

func (directory SqlCreatorsDirectory) FindUserSummaries(ctx context.Context, accountIds []string) (map[string]UserSummary, error) {
	summaries := map[string]UserSummary{}
	if len(accountIds) == 0 {
		return summaries, nil
	}
	marks, arguments := placeholders(accountIds)
	rows, err := directory.Database.QueryContext(ctx, "SELECT account_id::text, COALESCE(handle, ''), COALESCE(display_name, ''), avatar_url, verified FROM "+
		directory.table(directory.UsersSchema, "profiles")+" WHERE kind = 'personal' AND account_id::text IN ("+marks+")", arguments...)
	if err != nil {
		if directory.unreadable(err) {
			return summaries, nil
		}
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var summary UserSummary
		if err := rows.Scan(&summary.Id, &summary.Username, &summary.Name, &summary.AvatarUrl, &summary.Verified); err != nil {
			return nil, err
		}
		summaries[summary.Id] = summary
	}
	return summaries, rows.Err()
}

func (directory SqlCreatorsDirectory) queryStores(ctx context.Context, where string, arguments ...any) (map[string]StoreSummary, error) {
	stores := map[string]StoreSummary{}
	rows, err := directory.Database.QueryContext(ctx, "SELECT id::text, name, logo_url, owner_account_id::text, COALESCE(currency, ''), status = 'active' FROM "+
		directory.table(directory.CatalogSchema, "stores")+" WHERE "+where, arguments...)
	if err != nil {
		if directory.unreadable(err) {
			return stores, nil
		}
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var store StoreSummary
		if err := rows.Scan(&store.Id, &store.Name, &store.LogoUrl, &store.OwnerUserId, &store.Currency, &store.Active); err != nil {
			return nil, err
		}
		stores[store.Id] = store
	}
	return stores, rows.Err()
}

func (directory SqlCreatorsDirectory) FindStores(ctx context.Context, storeIds []string) (map[string]StoreSummary, error) {
	if len(storeIds) == 0 {
		return map[string]StoreSummary{}, nil
	}
	marks, arguments := placeholders(storeIds)
	return directory.queryStores(ctx, "id::text IN ("+marks+")", arguments...)
}

func (directory SqlCreatorsDirectory) FindOwnedStore(ctx context.Context, ownerUserId, storeId string) (StoreSummary, bool, error) {
	stores, err := directory.queryStores(ctx, "owner_account_id::text = $1 AND status <> 'closed' AND ($2 = '' OR id::text = $2) ORDER BY created_at LIMIT 1", ownerUserId, storeId)
	for _, store := range stores {
		return store, true, err
	}
	return StoreSummary{}, false, err
}

func (directory SqlCreatorsDirectory) queryProducts(ctx context.Context, where string, arguments ...any) ([]ProductSummary, error) {
	rows, err := directory.Database.QueryContext(ctx, "SELECT id::text, store_id::text, name, COALESCE(min_price_minor, 0), COALESCE(currency, ''), status = 'active' AND published_online FROM "+
		directory.table(directory.CatalogSchema, "products")+" WHERE "+where, arguments...)
	if err != nil {
		if directory.unreadable(err) {
			return nil, nil
		}
		return nil, err
	}
	defer rows.Close()
	products := []ProductSummary{}
	for rows.Next() {
		var product ProductSummary
		if err := rows.Scan(&product.Id, &product.StoreId, &product.Name, &product.PriceMinor, &product.Currency, &product.Published); err != nil {
			return nil, err
		}
		products = append(products, product)
	}
	return products, rows.Err()
}

func (directory SqlCreatorsDirectory) FindProducts(ctx context.Context, productIds []string) (map[string]ProductSummary, error) {
	found := map[string]ProductSummary{}
	if len(productIds) == 0 {
		return found, nil
	}
	marks, arguments := placeholders(productIds)
	products, err := directory.queryProducts(ctx, "id::text IN ("+marks+")", arguments...)
	for _, product := range products {
		found[product.Id] = product
	}
	return found, err
}

func (directory SqlCreatorsDirectory) ListStoreProducts(ctx context.Context, storeId, search string, limit int) ([]ProductSummary, error) {
	return directory.queryProducts(ctx, "store_id::text = $1 AND status = 'active' AND published_online AND ($2 = '' OR name ILIKE '%' || $2 || '%') ORDER BY created_at DESC LIMIT "+strconv.Itoa(limit), storeId, search)
}

func (directory SqlCreatorsDirectory) FollowerCount(ctx context.Context, accountId string) (int64, error) {
	var count int64
	err := directory.Database.QueryRowContext(ctx, `SELECT COUNT(*) FROM `+directory.table(directory.SocialSchema, "follows")+` WHERE "followeeId"::text = $1 AND state = 'accepted'`, accountId).Scan(&count)
	if err != nil && directory.unreadable(err) {
		return 0, nil
	}
	return count, err
}

func (directory SqlCreatorsDirectory) ApplicationStatus(ctx context.Context, accountId string) (string, error) {
	var status sql.NullString
	err := directory.Database.QueryRowContext(ctx, "SELECT creator_status::text FROM "+directory.table(directory.UsersSchema, "profiles")+
		" WHERE account_id::text = $1 AND kind = 'personal' LIMIT 1", accountId).Scan(&status)
	if errors.Is(err, sql.ErrNoRows) || (err != nil && directory.unreadable(err)) {
		return "", nil
	}
	return status.String, err
}
