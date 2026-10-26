package recordclientsignals

import (
	"context"
	"slices"

	"github.com/google/uuid"

	"nantty/modules/moderation/src/container"
	"nantty/modules/moderation/src/generated/ent"
	"nantty/modules/moderation/src/generated/ent/securityevent"
	"nantty/modules/moderation/src/integrations"
	"nantty/modules/moderation/src/modules/accessSecurity/services"
	"nantty/platform/httpserver"
)

var KnownHeadlessSignals = []string{"webdriver", "headless_user_agent", "no_languages", "zero_plugins", "automation_globals", "emulator", "rooted_or_jailbroken"}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (Result, error) {
	accountId, err := uuid.Parse(command.AccountId)
	if err != nil {
		return Result{}, httpserver.ErrUnauthorized
	}
	signals := []string{}
	for _, signal := range command.HeadlessSignals {
		if slices.Contains(KnownHeadlessSignals, signal) && !slices.Contains(signals, signal) {
			signals = append(signals, signal)
		}
	}
	verdict := ""
	if command.Attestation != nil && command.Attestation.Token != "" && handler.Container.DeviceAttestation != nil {
		verdict, err = handler.Container.DeviceAttestation.VerifyDeviceAttestation(ctx, accountId.String(), *command.Attestation)
		if err != nil {
			verdict = integrations.AttestationUnavailable
		}
	}
	now := handler.Container.Now()
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		state, err := services.LockOrCreateAccountState(ctx, tx, accountId)
		if err != nil {
			return err
		}
		update := state.Update()
		if len(signals) > 0 {
			update.SetHeadlessReported(true)
			state.HeadlessReported = true
		}
		if verdict == integrations.AttestationFailed || (verdict == integrations.AttestationPassed && state.AttestationVerdict != integrations.AttestationFailed) {
			update.SetAttestationVerdict(verdict)
			state.AttestationVerdict = verdict
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		if err := services.RecordSecurityEvent(ctx, tx, services.EventInput{
			AccountId: &accountId, Kind: securityevent.KindClientSignals, DeviceId: command.DeviceId, Source: "client",
			Detail: map[string]any{"platform": command.Platform, "headlessSignals": signals, "attestationVerdict": verdict},
		}, now); err != nil {
			return err
		}
		_, _, err = services.EvaluateAndMarkSuspectedBot(ctx, tx, state, services.Thresholds(handler.Container), now)
		return err
	})
	return Result{Received: true}, err
}
