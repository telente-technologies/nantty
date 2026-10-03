package identityports

import "sync"

type Registry struct {
	mutex    sync.RWMutex
	accounts AccountDirectory
	guard    UsernameGuard
	tokens   StaffTokenService
	audit    AuditRecorder
	country  AccountCountryLookup
	settings PlatformSettings
}

var Default = &Registry{}

func readPort[Port any](registry *Registry, selectPort func() Port) (Port, error) {
	registry.mutex.RLock()
	defer registry.mutex.RUnlock()
	port := selectPort()
	if any(port) == nil {
		return port, ErrPortNotRegistered
	}
	return port, nil
}

func (registry *Registry) RegisterAccountDirectory(port AccountDirectory) {
	registry.mutex.Lock()
	registry.accounts = port
	registry.mutex.Unlock()
}

func (registry *Registry) RegisterUsernameGuard(port UsernameGuard) {
	registry.mutex.Lock()
	registry.guard = port
	registry.mutex.Unlock()
}

func (registry *Registry) RegisterStaffTokenService(port StaffTokenService) {
	registry.mutex.Lock()
	registry.tokens = port
	registry.mutex.Unlock()
}

func (registry *Registry) RegisterAuditRecorder(port AuditRecorder) {
	registry.mutex.Lock()
	registry.audit = port
	registry.mutex.Unlock()
}

func (registry *Registry) RegisterAccountCountryLookup(port AccountCountryLookup) {
	registry.mutex.Lock()
	registry.country = port
	registry.mutex.Unlock()
}

func (registry *Registry) RegisterPlatformSettings(port PlatformSettings) {
	registry.mutex.Lock()
	registry.settings = port
	registry.mutex.Unlock()
}

func (registry *Registry) AccountDirectory() (AccountDirectory, error) {
	return readPort(registry, func() AccountDirectory { return registry.accounts })
}

func (registry *Registry) UsernameGuard() (UsernameGuard, error) {
	return readPort(registry, func() UsernameGuard { return registry.guard })
}

func (registry *Registry) StaffTokenService() (StaffTokenService, error) {
	return readPort(registry, func() StaffTokenService { return registry.tokens })
}

func (registry *Registry) AuditRecorder() (AuditRecorder, error) {
	return readPort(registry, func() AuditRecorder { return registry.audit })
}

func (registry *Registry) AccountCountryLookup() (AccountCountryLookup, error) {
	return readPort(registry, func() AccountCountryLookup { return registry.country })
}

func (registry *Registry) PlatformSettings() (PlatformSettings, error) {
	return readPort(registry, func() PlatformSettings { return registry.settings })
}
