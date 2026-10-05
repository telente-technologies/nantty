package routes

import (
	"net/http"

	"zudomart/modules/creators/src/modules/creatorProgram/controllers"
	"zudomart/modules/creators/src/modules/creatorProgram/services"
	"zudomart/modules/ledger/src/constants"
	"zudomart/modules/ledger/src/middlewares"
)

func MountCreatorProgramRoutes(mux *http.ServeMux, program services.CreatorProgram) {
	controller := CreatorProgramControllerFor(program)
	staff := program.Container.Resources.StaffVerifiers
	requireRead := middlewares.RequireStaffPermission(staff, constants.PermissionManageCreators, false)
	requireWrite := middlewares.RequireStaffPermission(staff, constants.PermissionManageCreators, true)
	mux.Handle("GET /api/v1/admin/creator-tiers", requireRead(http.HandlerFunc(controller.ListCreatorTiers)))
	mux.Handle("PUT /api/v1/admin/creator-tiers/{tierId}", requireWrite(http.HandlerFunc(controller.UpdateCreatorTier)))
	mux.Handle("PUT /api/v1/admin/creators/{userId}/program", requireWrite(http.HandlerFunc(controller.SetCreatorMembership)))
	mux.Handle("GET /api/v1/admin/creators/{userId}/violations", requireRead(http.HandlerFunc(controller.ListViolations)))
	mux.Handle("POST /api/v1/admin/creators/{userId}/violations", requireWrite(http.HandlerFunc(controller.RecordViolation)))
}

func CreatorProgramControllerFor(program services.CreatorProgram) controllers.CreatorProgramController {
	return controllers.CreatorProgramController{Program: program}
}
