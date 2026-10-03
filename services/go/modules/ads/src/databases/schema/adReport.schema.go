package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type AdScheduledReport struct{ ent.Schema }

func (AdScheduledReport) Mixin() []ent.Mixin { return []ent.Mixin{TimeOrderedIdentifierMixin{}} }

func (AdScheduledReport) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.UUID("created_by", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(120),
		field.JSON("recipients", []string{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Enum("frequency").Values("daily", "weekly", "monthly"),
		field.String("breakdown").MaxLen(20),
		field.JSON("metrics", []string{}).SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Time("next_send_at"),
		field.Time("last_sent_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (AdScheduledReport) Indexes() []ent.Index {
	return []ent.Index{index.Fields("account_id", "created_at"), index.Fields("next_send_at")}
}
