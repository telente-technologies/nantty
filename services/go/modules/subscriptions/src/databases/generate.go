package databases

//go:generate go run entgo.io/ent/cmd/ent generate --feature sql/lock,sql/versioned-migration,sql/execquery,sql/upsert,sql/schemaconfig --target ../generated/ent ./schema
