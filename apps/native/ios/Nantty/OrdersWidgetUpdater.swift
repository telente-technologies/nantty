import CryptoKit
import WidgetKit

@MainActor
enum OrdersWidgetUpdater {
    static func markSignedOut() {
        OrdersWidgetSnapshotStore.markSignedOut()
        reload()
    }

    static func refresh(using session: SessionModel) async {
        guard session.phase == .signedIn, let userID = session.user?.id else {
            markSignedOut()
            return
        }

        let accountFingerprint = fingerprint(userID)
        do {
            let response = try await session.fetchOrdersWidget()
            guard session.phase == .signedIn, session.user?.id == userID else {
                markSignedOut()
                return
            }
            OrdersWidgetSnapshotStore.save(
                OrdersWidgetSnapshotMapper.make(from: response, accountFingerprint: accountFingerprint)
            )
        } catch {
            guard session.phase == .signedIn, let currentUserID = session.user?.id else {
                OrdersWidgetSnapshotStore.markSignedOut()
                reload()
                return
            }
            if currentUserID != userID {
                OrdersWidgetSnapshotStore.recordRefreshFailure(accountFingerprint: fingerprint(currentUserID))
            } else {
                OrdersWidgetSnapshotStore.recordRefreshFailure(accountFingerprint: accountFingerprint)
            }
        }
        reload()
    }

    static func reload() {
        WidgetCenter.shared.reloadTimelines(ofKind: "NanttyOrdersWidget")
    }

    private static func fingerprint(_ userID: String) -> String {
        SHA256.hash(data: Data(userID.utf8)).prefix(12).map { String(format: "%02x", $0) }.joined()
    }
}
