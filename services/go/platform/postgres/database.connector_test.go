package postgres

import (
	"testing"
	"time"
)

func TestPoolSizeIsTunablePerDeployableAndIdleConnectionsAreReaped(t *testing.T) {
	t.Setenv("POSTGRES_MAX_OPEN_CONNECTIONS", "")
	t.Setenv("POSTGRES_MAX_IDLE_CONNECTIONS", "")
	defaults := DefaultPoolSettings()
	if defaults.MaximumOpenConnections != 20 || defaults.MaximumIdleConnections != 5 || defaults.ConnectionMaximumIdle != 5*time.Minute {
		t.Fatalf("defaults = %+v", defaults)
	}
	t.Setenv("POSTGRES_MAX_OPEN_CONNECTIONS", "8")
	t.Setenv("POSTGRES_MAX_IDLE_CONNECTIONS", "12")
	tuned := DefaultPoolSettings()
	if tuned.MaximumOpenConnections != 8 || tuned.MaximumIdleConnections != 8 {
		t.Fatalf("tuned = %+v, want 8 open and idle capped at 8", tuned)
	}
	t.Setenv("POSTGRES_MAX_OPEN_CONNECTIONS", "-3")
	if DefaultPoolSettings().MaximumOpenConnections != 20 {
		t.Fatal("a non-positive value must fall back to the default")
	}
}
