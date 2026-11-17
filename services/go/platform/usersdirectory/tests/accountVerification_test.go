package usersdirectory_test

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"testing"

	"github.com/google/uuid"
	"nantty/platform/usersdirectory"
)

type accountQueryState struct {
	verified  bool
	found     bool
	err       error
	query     string
	arguments []driver.NamedValue
}

type accountConnector struct{ state *accountQueryState }

func (connector accountConnector) Connect(context.Context) (driver.Conn, error) {
	return accountConnection{state: connector.state}, nil
}

func (accountConnector) Driver() driver.Driver { return accountDriver{} }

type accountDriver struct{}

func (accountDriver) Open(string) (driver.Conn, error) { return nil, errors.New("connector required") }

type accountConnection struct{ state *accountQueryState }

func (accountConnection) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("prepare unsupported")
}
func (accountConnection) Close() error { return nil }
func (accountConnection) Begin() (driver.Tx, error) {
	return nil, errors.New("transaction unsupported")
}

func (connection accountConnection) QueryContext(_ context.Context, query string, arguments []driver.NamedValue) (driver.Rows, error) {
	connection.state.query = query
	connection.state.arguments = append([]driver.NamedValue(nil), arguments...)
	if connection.state.err != nil {
		return nil, connection.state.err
	}
	values := [][]driver.Value{}
	if connection.state.found {
		values = append(values, []driver.Value{connection.state.verified})
	}
	return &accountRows{values: values}, nil
}

type accountRows struct {
	values [][]driver.Value
	index  int
}

var errAccountDatabaseUnavailable = errors.New("database unavailable")

func (*accountRows) Columns() []string { return []string{"verified"} }
func (*accountRows) Close() error      { return nil }
func (rows *accountRows) Next(destination []driver.Value) error {
	if rows.index >= len(rows.values) {
		return io.EOF
	}
	copy(destination, rows.values[rows.index])
	rows.index++
	return nil
}

func TestStaticAccountEmailVerifier(t *testing.T) {
	accountId := uuid.New()
	tests := []struct {
		name     string
		verifier usersdirectory.StaticAccountEmailVerifier
		verified bool
		wantErr  bool
	}{
		{name: "verified", verifier: usersdirectory.StaticAccountEmailVerifier{Verified: true}, verified: true},
		{name: "unverified", verifier: usersdirectory.StaticAccountEmailVerifier{}},
		{name: "lookup error", verifier: usersdirectory.StaticAccountEmailVerifier{Err: errors.New("unavailable")}, wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := test.verifier.IsEmailVerified(context.Background(), accountId)
			if (err != nil) != test.wantErr || got != test.verified {
				t.Fatalf("IsEmailVerified() = (%t, %v), want (%t, error=%t)", got, err, test.verified, test.wantErr)
			}
		})
	}
}

func TestSqlAccountEmailVerifier(t *testing.T) {
	accountId := uuid.New()
	tests := []struct {
		name     string
		state    accountQueryState
		verified bool
		wantErr  error
	}{
		{name: "verified account", state: accountQueryState{found: true, verified: true}, verified: true},
		{name: "unverified account", state: accountQueryState{found: true}},
		{name: "unknown account", state: accountQueryState{}, wantErr: usersdirectory.ErrAccountNotFound},
		{name: "database error", state: accountQueryState{err: errAccountDatabaseUnavailable}, wantErr: errAccountDatabaseUnavailable},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			state := test.state
			database := sql.OpenDB(accountConnector{state: &state})
			defer database.Close()
			verifier := usersdirectory.SqlAccountEmailVerifier{Database: database, Schema: "auth-test"}
			got, err := verifier.IsEmailVerified(context.Background(), accountId)
			if got != test.verified || !errors.Is(err, test.wantErr) {
				t.Fatalf("IsEmailVerified() = (%t, %v), want (%t, %v)", got, err, test.verified, test.wantErr)
			}
			if test.name == "database error" {
				return
			}
			if state.query != `SELECT email_verified_at IS NOT NULL FROM "auth-test"."accounts" WHERE id = $1` {
				t.Fatalf("query = %q", state.query)
			}
			if len(state.arguments) != 1 || fmt.Sprint(state.arguments[0].Value) != accountId.String() {
				t.Fatalf("query arguments = %#v", state.arguments)
			}
		})
	}
}
