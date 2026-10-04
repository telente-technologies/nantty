package identityports

import "sync"

type Registry struct {
	mutex       sync.RWMutex
	accounts    AccountDirectory
	guard       UsernameGuard
	tokens      StaffTokenService
	audit       AuditRecorder
	country     AccountCountryLookup
	settings    PlatformSettings
	enforcement AccountEnforcement
	sessions    StaffSessionChecker
	history     AuditHistoryReader
	currencies  CurrencyResolver
	deletions   DeletionGraceCanceller
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

func (registry *Registry) RegisterAccountEnforcement(port AccountEnforcement) {
	registry.mutex.Lock()
	registry.enforcement = port
	registry.mutex.Unlock()
}

func (registry *Registry) AccountEnforcement() (AccountEnforcement, error) {
	return readPort(registry, func() AccountEnforcement { return registry.enforcement })
}

func (registry *Registry) RegisterStaffSessionChecker(port StaffSessionChecker) {
	registry.mutex.Lock()
	registry.sessions = port
	registry.mutex.Unlock()
}

func (registry *Registry) StaffSessionChecker() (StaffSessionChecker, error) {
	return readPort(registry, func() StaffSessionChecker { return registry.sessions })
}

func (registry *Registry) RegisterAuditHistoryReader(port AuditHistoryReader) {
	registry.mutex.Lock()
	registry.history = port
	registry.mutex.Unlock()
}

func (registry *Registry) AuditHistoryReader() (AuditHistoryReader, error) {
	return readPort(registry, func() AuditHistoryReader { return registry.history })
}

func (registry *Registry) RegisterCurrencyResolver(port CurrencyResolver) {
	registry.mutex.Lock()
	registry.currencies = port
	registry.mutex.Unlock()
}

func (registry *Registry) CurrencyResolver() (CurrencyResolver, error) {
	return readPort(registry, func() CurrencyResolver { return registry.currencies })
}

func (registry *Registry) RegisterDeletionGraceCanceller(port DeletionGraceCanceller) {
	registry.mutex.Lock()
	registry.deletions = port
	registry.mutex.Unlock()
}

func (registry *Registry) DeletionGraceCanceller() (DeletionGraceCanceller, error) {
	return readPort(registry, func() DeletionGraceCanceller { return registry.deletions })
}
