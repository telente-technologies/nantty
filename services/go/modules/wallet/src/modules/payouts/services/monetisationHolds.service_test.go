package services

import (
	"strings"
	"testing"

	"entgo.io/ent/dialect"
	entsql "entgo.io/ent/dialect/sql"

	"nantty/modules/wallet/src/generated/ent/monetisationhold"
)

func TestHealthChangeUpsertOnlyOverwritesWithANewerOrEqualEvent(t *testing.T) {
	query, _ := entsql.Dialect(dialect.Postgres).Insert(monetisationhold.Table).
		Columns(monetisationhold.FieldID, monetisationhold.FieldHealthChangedAt).Values("acct-1", "2026-10-04T12:00:00Z").
		OnConflict(HealthChangeConflictOptions()...).Query()
	for _, want := range []string{`ON CONFLICT ("id") DO UPDATE SET`, `"health_changed_at" = "excluded"."health_changed_at"`, `WHERE "monetisation_holds"."health_changed_at" <= EXCLUDED."health_changed_at"`} {
		if !strings.Contains(query, want) {
			t.Fatalf("missing %q in %s", want, query)
		}
	}
}
