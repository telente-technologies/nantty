import Foundation

enum NotificationDestination: Equatable {
    case post(String)
    case profile(String)
}

enum NotificationRouting {
    static func destination(for notification: AppNotification) -> NotificationDestination? {
        if notification.kind == "followRequestAccepted",
           let actorID = notification.actor?.id,
           let userID = PublicProfileAPI.validatedUserID(actorID) {
            return .profile(userID)
        }
        guard let postID = validatedPostID(notification.data?["postId"]) else { return nil }
        return .post(postID)
    }

    static func validatedPostID(_ value: String?) -> String? {
        guard let value, (1...128).contains(value.utf8.count),
              value.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
            return nil
        }
        return value
    }
}
