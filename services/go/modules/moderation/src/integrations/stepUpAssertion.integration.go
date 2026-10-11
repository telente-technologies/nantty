package integrations

import "context"

type stepUpTokenKey struct{}

func ContextWithStepUpToken(ctx context.Context, token string) context.Context {
	return context.WithValue(ctx, stepUpTokenKey{}, token)
}

func StepUpTokenFromContext(ctx context.Context) string {
	token, _ := ctx.Value(stepUpTokenKey{}).(string)
	return token
}
