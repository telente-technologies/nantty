package completemfalogin

import (
	"context"

	"zudomart/modules/admin/src/container"
	"zudomart/modules/admin/src/generated/ent/staffloginchallenge"
	"zudomart/modules/admin/src/modules/staffAuth/models"
	"zudomart/modules/admin/src/modules/staffAuth/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.StaffSessionResult, error) {
	return services.StaffAuthService{Container: handler.Container}.CompleteMfaChallenge(ctx, command.ChallengeToken,
		services.SecondFactorProof{Method: command.Method, Code: command.Code, Credential: command.Credential}, staffloginchallenge.PurposeLogin)
}
