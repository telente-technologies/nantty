package sellerplans

import (
	"net/http"

	"github.com/google/uuid"

	"nantty/platform/httpserver"
)

type planRequiredBody struct {
	Message      string `json:"message"`
	Code         string `json:"code"`
	RequiredPlan Plan   `json:"requiredPlan"`
}

func WritePlanFeatureRequired(writer http.ResponseWriter, required Plan) {
	httpserver.WriteJsonResponse(writer, http.StatusPaymentRequired, planRequiredBody{
		Message: "Upgrade to the " + string(required) + " plan to use this feature.", Code: "PLAN_FEATURE_REQUIRED", RequiredPlan: required,
	})
}

func (resolver *Resolver) RequireFeature(writer http.ResponseWriter, request *http.Request, ownerAccountId uuid.UUID, feature string) bool {
	required := MinimumPlanFor(feature)
	if resolver.PlanOf(request.Context(), ownerAccountId).AtLeast(required) {
		return true
	}
	WritePlanFeatureRequired(writer, required)
	return false
}
