package logistics

import (
	"errors"
	"sort"
	"strings"
	"sync"
)

var (
	ErrProviderNotFound = errors.New("logistics provider not found")
	ErrProviderInvalid  = errors.New("logistics provider is invalid")
	ErrProviderTaken    = errors.New("logistics provider is already registered")
)

// Registry holds the configured provider adapters. It is hidden by default:
// when disabled, lookups return ErrProviderNotFound even if adapters were
// registered during startup.
type Registry struct {
	enabled   bool
	mu        sync.RWMutex
	providers map[string]Provider
}

func NewRegistry(enabled bool) *Registry {
	return &Registry{enabled: enabled, providers: map[string]Provider{}}
}

func (registry *Registry) Enabled() bool {
	return registry != nil && registry.enabled
}

func (registry *Registry) Register(provider Provider) error {
	if provider == nil {
		return ErrProviderInvalid
	}
	name := strings.TrimSpace(provider.Name())
	if name == "" {
		return ErrProviderInvalid
	}
	registry.mu.Lock()
	defer registry.mu.Unlock()
	if _, exists := registry.providers[name]; exists {
		return ErrProviderTaken
	}
	registry.providers[name] = provider
	return nil
}

func (registry *Registry) Provider(name string) (Provider, bool) {
	if !registry.Enabled() {
		return nil, false
	}
	registry.mu.RLock()
	defer registry.mu.RUnlock()
	provider, found := registry.providers[strings.TrimSpace(name)]
	return provider, found
}

func (registry *Registry) Names() []string {
	if !registry.Enabled() {
		return nil
	}
	registry.mu.RLock()
	defer registry.mu.RUnlock()
	names := make([]string, 0, len(registry.providers))
	for name := range registry.providers {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
