package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type StaffWebauthnCredential struct {
	ent.Schema
}

func (StaffWebauthnCredential) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (StaffWebauthnCredential) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("staff_id", uuid.UUID{}).Immutable(),
		field.String("credential_id").NotEmpty().MaxLen(1024).Immutable(),
		field.Bytes("credential").Sensitive().SchemaType(map[string]string{dialect.Postgres: "jsonb"}),
		field.Int64("sign_count").Default(0).NonNegative(),
		field.Strings("transports").Default([]string{}),
		field.String("label").NotEmpty().MaxLen(60),
		field.Time("last_used_at").Optional().Nillable(),
	}
}

func (StaffWebauthnCredential) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("staff", StaffAccount.Type).Ref("passkeys").Field("staff_id").Unique().Required().Immutable(),
	}
}

func (StaffWebauthnCredential) Indexes() []ent.Index {
	return []ent.Index{index.Fields("credential_id").Unique(), index.Fields("staff_id")}
}
