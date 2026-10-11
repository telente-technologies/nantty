package services

const walletHoldReleasedKind = "wallet.holdReleased"

func IsWalletHoldReleasedKind(entryKind string) bool {
	return entryKind == walletHoldReleasedKind
}

func IsWalletHoldCreditKind(entryKind string) bool {
	return entryKind == "wallet.funded" || entryKind == "escrow.movement.escrowRelease.succeeded"
}
