package configs

import (
	"zudomart/modules/ledger/src/loaders"
	platformconfig "zudomart/platform/config"
)

type CreatorsSettings struct {
	Money         loaders.MoneyModuleSettings
	DefaultTierId string
}

func ReadCreatorsSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) CreatorsSettings {
	return CreatorsSettings{
		Money:         loaders.ReadMoneyModuleSettingsFromEnvironment(reader, "creators"),
		DefaultTierId: reader.ReadStringOrDefault("CREATORS_DEFAULT_TIER", "starter"),
	}
}
