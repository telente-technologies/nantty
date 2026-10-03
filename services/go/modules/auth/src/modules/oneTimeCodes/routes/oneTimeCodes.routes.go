package routes

import (
	"net/http"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/modules/oneTimeCodes/controllers"
)

func MountOneTimeCodesRoutes(mux *http.ServeMux, container *container.Container) {
	controller := controllers.OneTimeCodesController{Container: container}
	mux.HandleFunc("POST /api/v1/auth/otp/send", controller.SendOneTimeCode)
	mux.HandleFunc("POST /api/v1/auth/otp/verify", controller.VerifyOneTimeCode)
}
