package databases

//go:generate go run entgo.io/ent/cmd/ent generate --feature sql/lock,sql/upsert,sql/versioned-migration,sql/execquery --target ../generated/ent ./schema
