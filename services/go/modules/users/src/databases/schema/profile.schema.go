package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type Profile struct {
	ent.Schema
}

func (Profile) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Profile) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.Enum("kind").Values("personal", "business").Immutable(),
		field.Enum("creator_status").Values("none", "pending", "approved", "rejected").Default("none"),
		field.String("handle").NotEmpty().MaxLen(30),
		field.String("display_name").Default("").MaxLen(80),
		field.String("bio").Default("").MaxLen(300),
		field.String("website").Optional().Nillable().MaxLen(200),
		field.String("avatar_media_key").Optional().Nillable().MaxLen(200),
		field.String("avatar_url").Optional().Nillable().MaxLen(500),
		field.String("banner_media_key").Optional().Nillable().MaxLen(200),
		field.String("banner_url").Optional().Nillable().MaxLen(500),
		field.Bool("is_private").Default(false),
		field.String("country_code").Optional().Nillable().MaxLen(2),
		field.Enum("theme").Values("system", "light", "dark").Default("system"),
		field.Enum("language").Values("en").Default("en"),
		field.Bool("push_notifications_enabled").Default(true),
		field.Bool("verified").Default(false),
		field.Enum("profile_type").Values("personal", "business", "brand", "government").Default("personal"),
		field.Enum("status").Values("active", "archived").Default("active"),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Profile) Edges() []ent.Edge {
	return []ent.Edge{edge.To("categories", BusinessCategory.Type)}
}

func (Profile) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("handle").Unique(),
		index.Fields("account_id").StorageKey("profile_account_id"),
		index.Fields("account_id").StorageKey("profile_one_personal_per_account").Unique().Annotations(entsql.IndexWhere("kind = 'personal'")),
	}
}
