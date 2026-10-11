package servicemodule

func IsKnownAppEnvironment(appEnv string) bool {
	switch appEnv {
	case "development", "staging", "production", "test":
		return true
	}
	return false
}
