package decidesuspensionappeal

import (
	"context"

	"github.com/google/uuid"

	usersErrors "nantty/modules/users/src/errors"
	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/accountsuspension"
	"nantty/modules/users/src/modules/accountEnforcement/services"
)

type TrustDecision struct {
	CaseId         string `json:"caseId"`
	AccountId      string `json:"accountId"`
	Outcome        string `json:"outcome"`
	AlreadyDecided bool   `json:"alreadyDecided"`
}

var decidedOutcomes = map[accountsuspension.AppealStatus]string{accountsuspension.AppealStatusUpheld: "UPHELD", accountsuspension.AppealStatusOverturned: "OVERTURNED"}

func (handler Handler) DecideFromTrust(ctx context.Context, command Command) (TrustDecision, error) {
	if _, err := services.RequireReason(command.Reason); err != nil {
		return TrustDecision{}, err
	}
	if command.Outcome != "UPHELD" && command.Outcome != "OVERTURNED" {
		return TrustDecision{}, usersErrors.ValidationFailedFor("outcome", "must be UPHELD or OVERTURNED")
	}
	suspensionId, err := uuid.Parse(command.SuspensionId)
	if err != nil {
		return TrustDecision{}, usersErrors.NotFound("That case was not found.")
	}
	suspension, err := handler.Container.Client.AccountSuspension.Get(ctx, suspensionId)
	if ent.IsNotFound(err) {
		return TrustDecision{}, usersErrors.NotFound("That case was not found.")
	}
	if err != nil {
		return TrustDecision{}, err
	}
	decision := TrustDecision{CaseId: suspension.ID.String(), AccountId: suspension.AccountID.String(), Outcome: command.Outcome}
	if previous, decided := decidedOutcomes[suspension.AppealStatus]; decided {
		if previous != command.Outcome {
			return TrustDecision{}, usersErrors.Conflict("APPEAL_ALREADY_DECIDED", "This appeal was already decided the other way.")
		}
		decision.AlreadyDecided = true
		return decision, nil
	}
	handler.skipDecisionEvent = true
	_, err = handler.Execute(ctx, command)
	return decision, err
}
