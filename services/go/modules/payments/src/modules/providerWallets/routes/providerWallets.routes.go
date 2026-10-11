package routes

import (
	"net/http"

	"zudomart/modules/ledger/src/middlewares"
	"zudomart/modules/payments/src/modules/gateway"
	"zudomart/modules/payments/src/modules/providerWallets/controllers"
)

const (
	PermissionPaymentWebhooks = "payments:webhooks"
	PermissionPaymentWallets  = "payments:wallets"
)

func MountProviderWalletsRoutes(mux *http.ServeMux, application *gateway.Application) {
	controller := controllers.ProviderWalletsController{Application: application}
	resources := application.Container.Resources
	requireUser := middlewares.RequireUserAccessToken(resources.AccessVerifier)
	webhookRead := middlewares.RequireStaffPermission(resources.StaffVerifiers, PermissionPaymentWebhooks, false)
	webhookWrite := middlewares.RequireStaffPermissionWithSingleUseStepUp(resources.StaffVerifiers, PermissionPaymentWebhooks)
	moneyMovingWalletWrite := middlewares.RequireStaffPermissionWithSingleUseStepUp(resources.StaffVerifiers, PermissionPaymentWallets)
	walletWrite := middlewares.RequireStaffPermission(resources.StaffVerifiers, PermissionPaymentWallets, true)
	mux.Handle("GET /api/v1/payments/wallet/me", requireUser(http.HandlerFunc(controller.GetMyWallet)))
	mux.Handle("POST /api/v1/payments/wallet/me/activate", requireUser(http.HandlerFunc(controller.ActivateMyWallet)))
	mux.Handle("POST /api/v1/payments/wallet-payments/{reference}", requireUser(http.HandlerFunc(controller.PayWithWallet)))
	mux.Handle("GET /api/v1/admin/payments/webhooks/dead-letters", webhookRead(http.HandlerFunc(controller.ListDeadLetters)))
	mux.Handle("GET /api/v1/admin/payments/webhooks/dead-letters/{webhookId}", webhookRead(http.HandlerFunc(controller.GetDeadLetter)))
	mux.Handle("POST /api/v1/admin/payments/webhooks/dead-letters/{webhookId}/replay", webhookWrite(http.HandlerFunc(controller.ReplayDeadLetter)))
	mux.Handle("POST /api/v1/admin/payments/wallet-fundings/{reference}/reject", moneyMovingWalletWrite(http.HandlerFunc(controller.RejectFunding)))
	mux.Handle("POST /api/v1/admin/payments/wallets/{userId}/unfreeze", walletWrite(http.HandlerFunc(controller.UnfreezeWallet)))
	mux.Handle("POST /api/v1/admin/payments/wallet-reconciliation/run", walletWrite(http.HandlerFunc(controller.RunReconciliation)))
}
