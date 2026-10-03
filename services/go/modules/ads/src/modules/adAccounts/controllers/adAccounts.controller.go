package controllers

import (
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/ads/src/container"
	acceptinvite "zudomart/modules/ads/src/modules/adAccounts/commands/acceptInvite"
	changememberrole "zudomart/modules/ads/src/modules/adAccounts/commands/changeMemberRole"
	createadaccount "zudomart/modules/ads/src/modules/adAccounts/commands/createAdAccount"
	invitemember "zudomart/modules/ads/src/modules/adAccounts/commands/inviteMember"
	removemember "zudomart/modules/ads/src/modules/adAccounts/commands/removeMember"
	revokeinvite "zudomart/modules/ads/src/modules/adAccounts/commands/revokeInvite"
	updateadaccount "zudomart/modules/ads/src/modules/adAccounts/commands/updateAdAccount"
	"zudomart/modules/ads/src/modules/adAccounts/dtos"
	getaccount "zudomart/modules/ads/src/modules/adAccounts/queries/getAccount"
	getentitlements "zudomart/modules/ads/src/modules/adAccounts/queries/getEntitlements"
	listaccounts "zudomart/modules/ads/src/modules/adAccounts/queries/listAccounts"
	listactivity "zudomart/modules/ads/src/modules/adAccounts/queries/listActivity"
	listbusinessprofiles "zudomart/modules/ads/src/modules/adAccounts/queries/listBusinessProfiles"
	listinvites "zudomart/modules/ads/src/modules/adAccounts/queries/listInvites"
	listmembers "zudomart/modules/ads/src/modules/adAccounts/queries/listMembers"
	previewinvite "zudomart/modules/ads/src/modules/adAccounts/queries/previewInvite"
	"zudomart/modules/ads/src/utils"
	"zudomart/platform/httpserver"
)

type AdAccountsController struct{ Container *container.Container }

func (controller AdAccountsController) run(writer http.ResponseWriter, request *http.Request, work func(user, account uuid.UUID) error) {
	utils.Responder{Logger: controller.Container.Logger}.Run(writer, request, func() error {
		user, err := utils.ActorUserId(request)
		if err != nil {
			return err
		}
		account := uuid.Nil
		if request.PathValue("accountId") != "" {
			if account, err = utils.PathIdentifier(request, "accountId"); err != nil {
				return err
			}
		}
		return work(user, account)
	})
}

func list[Item any](writer http.ResponseWriter, items []Item, err error) error {
	if err != nil {
		return err
	}
	httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, ""))
	return nil
}

func (controller AdAccountsController) ListMemberships(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, _ uuid.UUID) error {
		items, err := (listaccounts.Handler{Container: controller.Container}).ListMemberships(request.Context(), listaccounts.Query{UserId: user})
		return list(writer, items, err)
	})
}

func (controller AdAccountsController) ListAccounts(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, _ uuid.UUID) error {
		items, err := (listaccounts.Handler{Container: controller.Container}).ListAccounts(request.Context(), listaccounts.Query{UserId: user})
		return list(writer, items, err)
	})
}

func (controller AdAccountsController) ListBusinessProfiles(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, _ uuid.UUID) error {
		items, err := (listbusinessprofiles.Handler{Container: controller.Container}).Execute(request.Context(), listbusinessprofiles.Query{UserId: user})
		return list(writer, items, err)
	})
}

func (controller AdAccountsController) CreateAccount(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, _ uuid.UUID) error {
		var body dtos.CreateAdAccountRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := createadaccount.Validate(body); err != nil {
			return err
		}
		account, err := (createadaccount.Handler{Container: controller.Container}).Execute(request.Context(), createadaccount.Command{UserId: user, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, account)
		return nil
	})
}

func (controller AdAccountsController) GetAccount(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		result, err := (getaccount.Handler{Container: controller.Container}).Execute(request.Context(), getaccount.Query{AccountId: account, UserId: user})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller AdAccountsController) UpdateAccount(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.UpdateAdAccountRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := updateadaccount.Validate(body); err != nil {
			return err
		}
		result, err := (updateadaccount.Handler{Container: controller.Container}).Execute(request.Context(), updateadaccount.Command{AccountId: account, UserId: user, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller AdAccountsController) GetEntitlements(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		result, err := (getentitlements.Handler{Container: controller.Container}).Execute(request.Context(), getentitlements.Query{AccountId: account, UserId: user})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, result)
		return nil
	})
}

func (controller AdAccountsController) ListMembers(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		items, err := (listmembers.Handler{Container: controller.Container}).Execute(request.Context(), listmembers.Query{AccountId: account, UserId: user})
		return list(writer, items, err)
	})
}

func (controller AdAccountsController) ChangeMemberRole(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		target, err := utils.PathIdentifier(request, "userId")
		if err != nil {
			return err
		}
		var body dtos.ChangeRoleRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		member, err := (changememberrole.Handler{Container: controller.Container}).Execute(request.Context(), changememberrole.Command{AccountId: account, ActorUserId: user, TargetUserId: target, Role: body.Role})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, member)
		return nil
	})
}

func (controller AdAccountsController) RemoveMember(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		target, err := utils.PathIdentifier(request, "userId")
		if err != nil {
			return err
		}
		if err := (removemember.Handler{Container: controller.Container}).Execute(request.Context(), removemember.Command{AccountId: account, ActorUserId: user, TargetUserId: target}); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}

func (controller AdAccountsController) ListInvites(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		items, err := (listinvites.Handler{Container: controller.Container}).Execute(request.Context(), listinvites.Query{AccountId: account, UserId: user})
		return list(writer, items, err)
	})
}

func (controller AdAccountsController) InviteMember(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		var body dtos.InviteMemberRequest
		if err := utils.DecodeBody(writer, request, &body); err != nil {
			return err
		}
		if err := invitemember.Validate(body); err != nil {
			return err
		}
		invite, err := (invitemember.Handler{Container: controller.Container}).Execute(request.Context(), invitemember.Command{AccountId: account, ActorUserId: user, Request: body})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusCreated, invite)
		return nil
	})
}

func (controller AdAccountsController) RevokeInvite(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		inviteId, err := utils.PathIdentifier(request, "inviteId")
		if err != nil {
			return err
		}
		if err := (revokeinvite.Handler{Container: controller.Container}).Execute(request.Context(), revokeinvite.Command{AccountId: account, InviteId: inviteId, ActorUserId: user}); err != nil {
			return err
		}
		httpserver.WriteNoContentResponse(writer)
		return nil
	})
}

func (controller AdAccountsController) PreviewInvite(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, _ uuid.UUID) error {
		inviteId, err := utils.PathIdentifier(request, "inviteId")
		if err != nil {
			return err
		}
		preview, err := (previewinvite.Handler{Container: controller.Container}).Execute(request.Context(), previewinvite.Query{InviteId: inviteId, UserId: user})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, preview)
		return nil
	})
}

func (controller AdAccountsController) AcceptInvite(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, _ uuid.UUID) error {
		inviteId, err := utils.PathIdentifier(request, "inviteId")
		if err != nil {
			return err
		}
		accountId, err := (acceptinvite.Handler{Container: controller.Container}).Execute(request.Context(), acceptinvite.Command{InviteId: inviteId, UserId: user})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, map[string]string{"accountId": accountId.String()})
		return nil
	})
}

func (controller AdAccountsController) ListActivity(writer http.ResponseWriter, request *http.Request) {
	controller.run(writer, request, func(user, account uuid.UUID) error {
		limit, err := utils.PageLimit(request, 50)
		if err != nil {
			return err
		}
		cursor, err := utils.DecodeCursor(request)
		if err != nil {
			return err
		}
		items, next, err := (listactivity.Handler{Container: controller.Container}).Execute(request.Context(), listactivity.Query{AccountId: account, UserId: user, ObjectType: request.URL.Query().Get("objectType"), Cursor: cursor, Limit: limit})
		if err != nil {
			return err
		}
		httpserver.WriteJsonResponse(writer, http.StatusOK, httpserver.NewCursorPage(items, next))
		return nil
	})
}
