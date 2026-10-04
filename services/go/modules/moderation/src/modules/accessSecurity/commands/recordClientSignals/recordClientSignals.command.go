package recordclientsignals

import "zudomart/modules/moderation/src/integrations"

type Command struct {
	AccountId       string                          `json:"-"`
	DeviceId        string                          `json:"-"`
	Platform        string                          `json:"platform"`
	HeadlessSignals []string                        `json:"headlessSignals"`
	Attestation     *integrations.DeviceAttestation `json:"attestation"`
}

type Result struct {
	Received bool `json:"received"`
}
