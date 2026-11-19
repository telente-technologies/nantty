package sellerdevelopers

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/middlewares"
	"nantty/platform/httpserver"
)

type Controller struct {
	Container *container.Container
}

func Mount(mux *http.ServeMux, deployed *container.Container) {
	controller := Controller{Container: deployed}
	guard := middlewares.StoreMemberFeature(deployed, "developer:manage", "api_webhooks", false)
	mux.Handle("GET /api/v1/seller/developers/api-keys", guard(controller.ListApiKeys))
	mux.Handle("POST /api/v1/seller/developers/api-keys", guard(controller.CreateApiKey))
	mux.Handle("DELETE /api/v1/seller/developers/api-keys/{keyId}", guard(controller.RevokeApiKey))
	mux.Handle("GET /api/v1/seller/developers/webhooks", guard(controller.ListWebhooks))
	mux.Handle("POST /api/v1/seller/developers/webhooks", guard(controller.CreateWebhook))
	mux.Handle("PATCH /api/v1/seller/developers/webhooks/{webhookId}", guard(controller.UpdateWebhook))
	mux.Handle("DELETE /api/v1/seller/developers/webhooks/{webhookId}", guard(controller.DeleteWebhook))
	mux.Handle("POST /api/v1/seller/developers/webhooks/{webhookId}/test", guard(controller.TestWebhook))
	mux.Handle("GET /api/v1/seller/developers/webhook-deliveries", guard(controller.ListDeliveries))
}

func (controller Controller) ListApiKeys(writer http.ResponseWriter, request *http.Request) {
	access := middlewares.StoreAccessFrom(request.Context())
	rows, err := controller.Container.Database.QueryContext(request.Context(),
		`SELECT id::text, name, prefix, scopes, created_by::text, created_at, last_used_at
		 FROM seller_api_keys WHERE store_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`, access.StoreId,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	defer rows.Close()
	items := []ApiKeyView{}
	for rows.Next() {
		var k ApiKeyView
		var scopesRaw []byte
		var lastUsed sql.NullTime
		if err := rows.Scan(&k.Id, &k.Name, &k.Prefix, &scopesRaw, &k.CreatedBy, &k.CreatedAt, &lastUsed); err != nil {
			httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
			return
		}
		_ = json.Unmarshal(scopesRaw, &k.Scopes)
		if lastUsed.Valid {
			k.LastUsedAt = &lastUsed.Time
		}
		items = append(items, k)
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]any{"data": items, "nextCursor": nil})
}

func (controller Controller) CreateApiKey(writer http.ResponseWriter, request *http.Request) {
	access := middlewares.StoreAccessFrom(request.Context())
	var body struct {
		Name   string   `json:"name"`
		Scopes []string `json:"scopes"`
	}
	if err := httpserver.DecodeJsonBodyRejectingUnknownFields(writer, request, &body); err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	name := strings.TrimSpace(body.Name)
	if len(name) < 2 || len(name) > 60 || !ValidScopes(body.Scopes) {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusBadRequest, "VALIDATION_FAILED", "Name (2-60 chars) and valid scopes are required."))
		return
	}
	var count int
	_ = controller.Container.Database.QueryRowContext(request.Context(), `SELECT COUNT(*) FROM seller_api_keys WHERE store_id = $1 AND revoked_at IS NULL`, access.StoreId).Scan(&count)
	if count >= 10 {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusConflict, "API_KEY_LIMIT_REACHED", "Maximum 10 active API keys reached."))
		return
	}
	raw := make([]byte, 24)
	_, _ = rand.Read(raw)
	secret := "zk_live_" + hex.EncodeToString(raw)
	prefix := secret[:12]
	sum := sha256.Sum256([]byte(secret))
	scopesJSON, _ := json.Marshal(body.Scopes)
	now := controller.Container.Now().UTC()
	id := uuid.New()
	actor := middlewares.AccountIdFrom(request.Context())
	_, err := controller.Container.Database.ExecContext(request.Context(),
		`INSERT INTO seller_api_keys (id, store_id, name, prefix, secret_hash, scopes, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
		id, access.StoreId, name, prefix, hex.EncodeToString(sum[:]), string(scopesJSON), actor, now,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	httpserver.WriteJsonResponse(writer, http.StatusCreated, map[string]any{
		"apiKey": ApiKeyView{Id: id.String(), Name: name, Prefix: prefix, Scopes: body.Scopes, CreatedBy: actor.String(), CreatedAt: now},
		"secret": secret,
	})
}

func (controller Controller) RevokeApiKey(writer http.ResponseWriter, request *http.Request) {
	access := middlewares.StoreAccessFrom(request.Context())
	keyId, err := uuid.Parse(request.PathValue("keyId"))
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "API_KEY_NOT_FOUND", "API key not found."))
		return
	}
	res, err := controller.Container.Database.ExecContext(request.Context(),
		`UPDATE seller_api_keys SET revoked_at = $1 WHERE id = $2 AND store_id = $3 AND revoked_at IS NULL`,
		controller.Container.Now().UTC(), keyId, access.StoreId,
	)
	if err != nil {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, err)
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		httpserver.WriteErrorResponse(writer, request, controller.Container.Logger, httpserver.NewApiError(http.StatusNotFound, "API_KEY_NOT_FOUND", "API key not found."))
		return
	}
	httpserver.WriteNoContentResponse(writer)
}
