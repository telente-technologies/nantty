module zudomart/modules/inventory

go 1.26.7

require (
	ariga.io/atlas v0.36.2-0.20250730182955-2c6300d0a3e1
	entgo.io/ent v0.14.6
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.11.0
	zudomart/platform v0.0.0
)

replace zudomart/platform => ../../platform
