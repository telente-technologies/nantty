package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
	"github.com/google/uuid"
)

type ProductOption struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
}

type ProductAttribute struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type ProductVideo struct {
	Id    string `json:"id"`
	Url   string `json:"url"`
	Title string `json:"title"`
}

type RegionalPrice struct {
	Currency            string `json:"currency"`
	PriceMinor          int64  `json:"priceMinor"`
	CompareAtPriceMinor *int64 `json:"compareAtPriceMinor,omitempty"`
}

type Product struct {
	ent.Schema
}

func (Product) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (Product) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("name").NotEmpty().MaxLen(120),
		field.String("description").Default("").MaxLen(5000),
		field.UUID("category_id", uuid.UUID{}).Optional().Nillable(),
		field.UUID("brand_id", uuid.UUID{}).Optional().Nillable(),
		field.String("brand_relationship").Optional().Nillable(),
		field.String("status").Default("draft"),
		field.String("visibility").Default("public"),
		field.Bool("published_online").Default(false),
		field.Bool("taxable").Default(true),
		field.Bool("track_inventory").Default(true),
		field.JSON("tags", []string{}).Optional(),
		field.JSON("options", []ProductOption{}).Optional(),
		field.JSON("attributes", []ProductAttribute{}).Optional(),
		field.JSON("videos", []ProductVideo{}).Optional(),
		field.UUID("supplier_id", uuid.UUID{}).Optional().Nillable(),
		field.String("currency").NotEmpty().MaxLen(3).Immutable(),
		field.Int64("min_price_minor").Default(0),
		field.Time("publish_at").Optional().Nillable(),
		field.Time("published_at").Optional().Nillable(),
		field.Int64("rating_sum").Default(0),
		field.Int("rating_count").Default(0),
		field.Int("like_count").Default(0),
		field.Int("units_sold").Default(0),
		field.String("moderation_visibility").Default("visible"),
		field.Time("moderation_visibility_at").Optional().Nillable(),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (Product) Indexes() []ent.Index {
	descending := func(columns ...string) entsql.IndexAnnotation {
		marks := map[string]bool{}
		for _, column := range columns {
			marks[column] = true
		}
		return entsql.IndexAnnotation{DescColumns: marks}
	}
	return []ent.Index{
		index.Fields("store_id", "status", "published_at", "id").Annotations(descending("published_at", "id")).StorageKey("product_store_status_published"),
		index.Fields("store_id", "status", "updated_at", "id").Annotations(descending("updated_at", "id")).StorageKey("product_store_status_updated"),
		index.Fields("category_id", "published_at", "id").Annotations(entsql.IndexAnnotation{
			DescColumns: map[string]bool{"published_at": true, "id": true}, Where: "status = 'active' AND visibility = 'public' AND published_online",
		}).StorageKey("product_category_listed"),
		index.Fields("published_at", "id").Annotations(entsql.IndexAnnotation{
			DescColumns: map[string]bool{"published_at": true, "id": true}, Where: "status = 'active' AND visibility = 'public' AND published_online",
		}).StorageKey("product_mart_listed"),
		index.Fields("publish_at").Annotations(entsql.IndexAnnotation{Where: "status = 'draft' AND publish_at IS NOT NULL"}).StorageKey("product_scheduled_due"),
		index.Fields("supplier_id"),
		index.Fields("brand_id"),
	}
}

type ProductVariant struct {
	ent.Schema
}

func (ProductVariant) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProductVariant) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("product_id", uuid.UUID{}).Immutable(),
		field.UUID("store_id", uuid.UUID{}).Immutable(),
		field.String("title").NotEmpty().MaxLen(200),
		field.JSON("option_values", map[string]string{}).Optional(),
		field.String("size").Default("").MaxLen(40),
		field.String("color").Default("").MaxLen(40),
		field.String("sku").NotEmpty().MaxLen(64),
		field.String("sku_key").NotEmpty().MaxLen(64),
		field.String("barcode").Optional().Nillable().MaxLen(14),
		field.Int64("price_minor"),
		field.Int64("compare_at_price_minor").Optional().Nillable(),
		field.Int64("cost_price_minor").Optional().Nillable(),
		field.JSON("regional_prices", []RegionalPrice{}).Optional(),
		field.Int("low_stock_threshold").Default(5),
		field.Int("reorder_point").Default(5),
		field.Int("reorder_quantity").Default(10),
		field.Int("position").Default(0),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (ProductVariant) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("store_id", "sku_key").Unique(),
		index.Fields("store_id", "barcode").Unique().Annotations(entsql.IndexAnnotation{Where: "barcode IS NOT NULL"}).StorageKey("productvariant_store_barcode_unique"),
		index.Fields("product_id", "position"),
	}
}

type ProductMedia struct {
	ent.Schema
}

func (ProductMedia) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProductMedia) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("product_id", uuid.UUID{}).Immutable(),
		field.String("media_id").NotEmpty().MaxLen(80).Immutable(),
		field.String("url").NotEmpty().MaxLen(500),
		field.String("kind").Default("image"),
		field.Int("position").Default(0),
	}
}

func (ProductMedia) Indexes() []ent.Index {
	return []ent.Index{index.Fields("product_id", "position"), index.Fields("product_id", "media_id").Unique()}
}

type ProductReaction struct {
	ent.Schema
}

func (ProductReaction) Mixin() []ent.Mixin {
	return []ent.Mixin{TimeOrderedIdentifierMixin{}}
}

func (ProductReaction) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("product_id", uuid.UUID{}).Immutable(),
		field.UUID("account_id", uuid.UUID{}).Immutable(),
		field.String("kind").NotEmpty().Immutable(),
	}
}

func (ProductReaction) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("product_id", "account_id", "kind").Unique(),
		index.Fields("account_id", "kind", "id").Annotations(entsql.IndexAnnotation{DescColumns: map[string]bool{"id": true}}),
	}
}
