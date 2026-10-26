package databases

import (
	"context"
	"database/sql"
	"io/fs"
	"net/url"
	"strings"
	"sync"

	"nantty/platform/postgres"
)

type sharedPoolEntry struct {
	database  *sql.DB
	userCount int
}

var (
	sharedPoolsMutex sync.Mutex
	sharedPools      = map[string]*sharedPoolEntry{}
)

func AcquireSharedMoneyDatabase(ctx context.Context, databaseUrl string) (*sql.DB, func() error, error) {
	sharedPoolsMutex.Lock()
	defer sharedPoolsMutex.Unlock()
	if entry, exists := sharedPools[databaseUrl]; exists {
		entry.userCount++
		return entry.database, releaseSharedMoneyDatabase(databaseUrl), nil
	}
	settings := postgres.DefaultPoolSettings()
	settings.MaximumOpenConnections = 40
	settings.MaximumIdleConnections = 10
	database, err := postgres.OpenDatabaseAndVerifyConnection(ctx, databaseUrl, settings)
	if err != nil {
		return nil, nil, err
	}
	sharedPools[databaseUrl] = &sharedPoolEntry{database: database, userCount: 1}
	return database, releaseSharedMoneyDatabase(databaseUrl), nil
}

func releaseSharedMoneyDatabase(databaseUrl string) func() error {
	var once sync.Once
	return func() error {
		var closeError error
		once.Do(func() {
			sharedPoolsMutex.Lock()
			defer sharedPoolsMutex.Unlock()
			entry, exists := sharedPools[databaseUrl]
			if !exists {
				return
			}
			entry.userCount--
			if entry.userCount == 0 {
				delete(sharedPools, databaseUrl)
				closeError = entry.database.Close()
			}
		})
		return closeError
	}
}

type ModuleMigrationTarget struct {
	DatabaseUrl string
	Schema      string
	OwnerRole   string
	Files       fs.FS
}

func ApplyModuleMigrationsAsSchemaOwner(target ModuleMigrationTarget) error {
	scopedUrl, err := postgres.ScopeDatabaseUrlToSchema(target.DatabaseUrl, target.Schema)
	if err != nil {
		return err
	}
	if target.OwnerRole != "" {
		scopedUrl, err = appendStartupRoleOption(scopedUrl, target.OwnerRole)
		if err != nil {
			return err
		}
	}
	return postgres.ApplyPendingMigrationsFromEmbeddedDirectory(scopedUrl, target.Files, ".")
}

func appendStartupRoleOption(databaseUrl, role string) (string, error) {
	parsed, err := url.Parse(databaseUrl)
	if err != nil {
		return "", err
	}
	query := parsed.Query()
	query.Set("options", "-c role="+role)
	parsed.RawQuery = strings.ReplaceAll(query.Encode(), "+", "%20")
	return parsed.String(), nil
}
