import Foundation

struct WidgetMoney: Codable, Hashable {
  let amountMinor: Int64
  let currency: String
}

struct OrderWidgetItem: Codable, Hashable, Identifiable {
  let id: String
  let reference: String
  let status: String
  let statusLabel: String
  let etaAt: String?
  let itemTitle: String
  let itemCount: Int
  let imageUrl: String?
  let storeName: String
  let deepLink: String
}

struct OrderWidgetPayload: Codable {
  let orders: [OrderWidgetItem]
  let activeCount: Int
}

struct SellerTodayWidgetPayload: Codable {
  let storeName: String
  let salesToday: WidgetMoney?
  let ordersToday: Int
  let ordersToShip: Int
  let availableBalance: WidgetMoney?
  let amountsHidden: Bool
  let deepLink: String
}

struct LiveNowWidgetItem: Codable, Hashable, Identifiable {
  let id: String
  let hostName: String
  let hostAvatarUrl: String?
  let title: String
  let viewers: Int
  let deepLink: String
}

struct LiveNowWidgetPayload: Codable {
  let lives: [LiveNowWidgetItem]
}

struct CreatorTodayWidgetPayload: Codable {
  let creatorProgramMember: Bool
  let viewsToday: Int
  let newFollowersToday: Int
  let earningsToday: WidgetMoney?
  let amountsHidden: Bool
  let deepLink: String
}

struct StoryWidgetPerson: Codable, Hashable, Identifiable {
  let userId: String
  let name: String
  let avatarUrl: String?
  let hasUnseen: Bool
  let deepLink: String
  var id: String { userId }
}

struct StoriesWidgetPayload: Codable {
  let people: [StoryWidgetPerson]
}

struct WidgetSessionDescriptor: Codable {
  let signedIn: Bool
  let apiBaseUrl: String
  let hideAmounts: Bool
}

struct WidgetSnapshotEnvelope<Payload: Codable>: Codable {
  let state: String
  let payload: Payload?
}

enum WidgetState<Payload> {
  case signedOut
  case unavailable
  case ready(Payload, images: [String: Data])
}
