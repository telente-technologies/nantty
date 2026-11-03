import Foundation

struct MyProfile: Decodable, Equatable {
    let name: String
    let username: String
    let bio: String
    let website: String?
    let avatarUrl: URL?
    let bannerUrl: URL?
    let followers: Int
    let following: Int
    let posts: Int
    let isPrivate: Bool

    init(
        name: String,
        username: String,
        bio: String,
        website: String?,
        followers: Int,
        following: Int,
        posts: Int,
        isPrivate: Bool,
        avatarUrl: URL? = nil,
        bannerUrl: URL? = nil
    ) {
        self.name = name
        self.username = username
        self.bio = bio
        self.website = website
        self.followers = followers
        self.following = following
        self.posts = posts
        self.isPrivate = isPrivate
        self.avatarUrl = avatarUrl
        self.bannerUrl = bannerUrl
    }

    private enum CodingKeys: String, CodingKey {
        case name, username, bio, website, avatarUrl, bannerUrl, followers, following, posts, isPrivate
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        name = try values.decode(String.self, forKey: .name)
        username = try values.decode(String.self, forKey: .username)
        bio = try values.decode(String.self, forKey: .bio)
        website = try values.decodeIfPresent(String.self, forKey: .website)
        avatarUrl = try values.decodeIfPresent(URL.self, forKey: .avatarUrl)
        bannerUrl = try values.decodeIfPresent(URL.self, forKey: .bannerUrl)
        followers = try values.decode(Int.self, forKey: .followers)
        following = try values.decode(Int.self, forKey: .following)
        posts = try values.decode(Int.self, forKey: .posts)
        isPrivate = try values.decode(Bool.self, forKey: .isPrivate)
    }

    static func safeImageURL(_ url: URL?) -> URL? {
        guard let url,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.user == nil,
              components.password == nil,
              let scheme = components.scheme?.lowercased(),
              let host = components.host?.lowercased(),
              !host.isEmpty,
              scheme == "https" || (scheme == "http" && ["localhost", "127.0.0.1", "::1"].contains(host)) else {
            return nil
        }
        return url
    }

    var displayAvatarURL: URL? { Self.safeImageURL(avatarUrl) }
    var displayBannerURL: URL? { Self.safeImageURL(bannerUrl) }
}

struct MyProfileUpdate: Encodable, Equatable {
    let name: String
    let bio: String
    let isPrivate: Bool
}

enum MyProfileFormValidation {
    static func message(name: String, bio: String) -> String? {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return "Add a display name before saving." }
        guard trimmedName.unicodeScalars.count <= 50 else { return "Display names can be up to 50 characters." }
        guard bio.unicodeScalars.count <= 160 else { return "Your bio can be up to 160 characters." }
        return nil
    }
}
