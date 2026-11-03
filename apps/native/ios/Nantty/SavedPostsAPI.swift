import Foundation

struct SavedPostPreview: Decodable, Equatable {
    let title: String?
    let thumbnailUrl: URL?
    let href: String
    let author: String?
    let durationSeconds: Double?
}

struct SavedPostItem: Decodable, Identifiable, Equatable {
    let id: String
    let type: String
    let targetId: String
    let savedAt: String
    let preview: SavedPostPreview
}

struct SavedPostsPage: Decodable, Equatable {
    let data: [SavedPostItem]
    let nextCursor: String?

    static func appending(_ incoming: [SavedPostItem], to current: [SavedPostItem]) -> [SavedPostItem] {
        var seen = Set(current.map(\.id))
        return current + incoming.filter { seen.insert($0.id).inserted }
    }
}
