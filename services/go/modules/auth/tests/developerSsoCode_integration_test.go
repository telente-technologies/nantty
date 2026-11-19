package auth_test

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	developersso "nantty/modules/auth/src/modules/developerSso"
	"nantty/platform/httpserver"
)

func TestSsoCodeSurvivesWrongVerifierAndRejectsRevokedSession(t *testing.T) {
	databaseURL := os.Getenv("AUTH_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("AUTH_TEST_DATABASE_URL is not configured")
	}
	ctx := context.Background()
	admin, err := sql.Open("pgx", databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	schema := "sso_test_" + uuid.NewString()[:8]
	quotedSchema := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.ExecContext(ctx, "CREATE SCHEMA "+quotedSchema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = admin.ExecContext(ctx, "DROP SCHEMA "+quotedSchema+" CASCADE") })
	parsed, err := url.Parse(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	parameters := parsed.Query()
	parameters.Set("search_path", schema)
	parsed.RawQuery = parameters.Encode()
	db, err := sql.Open("pgx", parsed.String())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, statement := range []string{
		`CREATE TABLE accounts (id uuid PRIMARY KEY, status text)`,
		`CREATE TABLE sessions (id uuid PRIMARY KEY, account_id uuid, revoked_at timestamptz, expires_at timestamptz)`,
		`CREATE TABLE developer_sso_codes (code_hash text PRIMARY KEY, account_id uuid, session_id uuid, client_id text, redirect_uri text, code_challenge text, expires_at timestamptz, consumed_at timestamptz)`,
	} {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	accountId, sessionId := uuid.New(), uuid.New()
	now := time.Now().UTC()
	if _, err := db.ExecContext(ctx, `INSERT INTO accounts VALUES ($1, 'active')`, accountId); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO sessions VALUES ($1, $2, NULL, $3)`, sessionId, accountId, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	verifier := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~"
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	insertCode := func(hash string) {
		t.Helper()
		if _, err := db.ExecContext(ctx,
			`INSERT INTO developer_sso_codes VALUES ($1, $2, $3, 'developer', 'https://developer.example/callback', $4, $5, NULL)`,
			hash, accountId, sessionId, challenge, now.Add(time.Minute),
		); err != nil {
			t.Fatal(err)
		}
	}
	consume := func(hash, candidate string) (string, string, error) {
		return developersso.ConsumeCode(ctx, db, hash, "developer", "https://developer.example/callback", candidate, now)
	}
	insertCode("first")
	if _, _, err := consume("first", verifier+"x"); !errors.Is(err, httpserver.NewApiError(http.StatusUnauthorized, "PKCE_VERIFICATION_FAILED", "")) {
		t.Fatalf("wrong verifier result: %v", err)
	}
	gotAccount, gotSession, err := consume("first", verifier)
	if err != nil || gotAccount != accountId.String() || gotSession != sessionId.String() {
		t.Fatalf("valid verifier after failed attempt: account=%q session=%q err=%v", gotAccount, gotSession, err)
	}
	if _, _, err := consume("first", verifier); !errors.Is(err, httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SSO_CODE", "")) {
		t.Fatalf("replayed code result: %v", err)
	}
	insertCode("revoked")
	if _, err := db.ExecContext(ctx, `UPDATE sessions SET revoked_at = $2 WHERE id = $1`, sessionId, now); err != nil {
		t.Fatal(err)
	}
	if _, _, err := consume("revoked", verifier); !errors.Is(err, httpserver.NewApiError(http.StatusUnauthorized, "INVALID_SSO_CODE", "")) {
		t.Fatalf("revoked session result: %v", err)
	}
}
