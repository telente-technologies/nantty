package controllers

import (
	"net/http"

	"github.com/google/uuid"

	adserrors "zudomart/modules/ads/src/errors"
	"zudomart/modules/ads/src/services"
	"zudomart/platform/httpserver"
)

type verificationView struct {
	Level     int     `json:"level"`
	Verified  bool    `json:"verified"`
	NextStep  *string `json:"nextStep"`
	Message   *string `json:"message"`
	VerifyUrl string  `json:"verifyUrl"`
}

func (controller AdAccountsController) GetVerification(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, _ uuid.UUID) error {
		status, err := controller.Container.Verification.ReadVerificationLevel(request.Context(), user.String())
		if err != nil {
			return adserrors.VerificationUnavailable
		}
		view := verificationView{Level: status.Level, Verified: status.Level >= services.PayoutVerifiedLevel, VerifyUrl: controller.Container.Settings.VerifyUrl}
		if status.NextStep != "" {
			view.NextStep = &status.NextStep
		}
		if !view.Verified {
			message := "Verify your payout details to use Zudomart Ads."
			view.Message = &message
		}
		writer.Header().Set("Cache-Control", "no-store")
		httpserver.WriteJsonResponse(writer, http.StatusOK, view)
		return nil
	})
}
