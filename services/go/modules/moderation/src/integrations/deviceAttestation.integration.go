package integrations

import "context"

const (
	AttestationPassed      = "passed"
	AttestationFailed      = "failed"
	AttestationUnavailable = "unavailable"
)

type DeviceAttestation struct {
	Provider  string `json:"provider"`
	Token     string `json:"token"`
	KeyId     string `json:"keyId,omitempty"`
	Challenge string `json:"challenge,omitempty"`
}

type DeviceAttestationVerifier interface {
	VerifyDeviceAttestation(ctx context.Context, accountId string, attestation DeviceAttestation) (string, error)
}

type PlayIntegrityVerifier interface {
	DecodeIntegrityTokenAndJudgeDevice(ctx context.Context, accountId, integrityToken string) (string, error)
}

type AppAttestVerifier interface {
	VerifyAppAttestAssertion(ctx context.Context, accountId, keyId, assertion, challenge string) (string, error)
}

type ProviderDeviceAttestationVerifier struct {
	PlayIntegrity PlayIntegrityVerifier
	AppAttest     AppAttestVerifier
}

func (verifier ProviderDeviceAttestationVerifier) VerifyDeviceAttestation(ctx context.Context, accountId string, attestation DeviceAttestation) (string, error) {
	switch attestation.Provider {
	case "play_integrity":
		if verifier.PlayIntegrity != nil {
			return verifier.PlayIntegrity.DecodeIntegrityTokenAndJudgeDevice(ctx, accountId, attestation.Token)
		}
	case "app_attest":
		if verifier.AppAttest != nil {
			return verifier.AppAttest.VerifyAppAttestAssertion(ctx, accountId, attestation.KeyId, attestation.Token, attestation.Challenge)
		}
	}
	return AttestationUnavailable, nil
}
