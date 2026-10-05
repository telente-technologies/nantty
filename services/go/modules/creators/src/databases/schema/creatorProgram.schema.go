package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type CreatorTier struct {
	ent.Schema
}

func (CreatorTier) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Checks(map[string]string{"creator_tiers_gift_share_capped": "gift_share_bps >= 0 AND gift_share_bps <= 7000"})}
}

func (CreatorTier) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").NotEmpty().MaxLen(40).Immutable(),
		field.String("name").NotEmpty().MaxLen(80),
		field.Int64("gift_share_bps"),
		field.Bool("is_default").Default(false),
		field.String("updated_by_staff_id").MaxLen(80).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

type CreatorProgramMember struct {
	ent.Schema
}

func (CreatorProgramMember) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (CreatorProgramMember) Fields() []ent.Field {
	return []ent.Field{
		field.String("user_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("tier_id").NotEmpty().MaxLen(40),
		field.Enum("status").Values("approved", "suspended").Default("approved"),
		field.String("suspension_reason").MaxLen(500).Default(""),
		field.Time("suspended_at").Optional().Nillable(),
		field.String("updated_by_staff_id").MaxLen(80).Default(""),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (CreatorProgramMember) Indexes() []ent.Index {
	return []ent.Index{index.Fields("user_id").Unique()}
}
