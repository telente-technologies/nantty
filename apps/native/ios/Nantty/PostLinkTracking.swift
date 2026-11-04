import Foundation

struct FeedInteraction: Encodable, Equatable {
    let postId: String
    let kind: String
    let surface: String

    static func postDetailLinkClick(postID: String) -> FeedInteraction {
        FeedInteraction(postId: postID, kind: "link_click", surface: "post_detail")
    }
}

struct FeedInteractionBatch: Encodable, Equatable {
    let events: [FeedInteraction]
}

enum PostTextLinks {
    private static let internalHosts: Set<String> = [
        "nantty.com", "www.nantty.com", "web.nantty.com"
    ]
    private static let internalPostPathKinds: Set<String> = ["post", "posts"]
    private static let commentQueryKeys: Set<String> = ["comment", "commentid", "reply"]

    static func internalPostID(from url: URL) -> String? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "https",
              let host = components.host?.lowercased(), internalHosts.contains(host),
              components.user == nil, components.password == nil, components.port == nil,
              components.queryItems?.contains(where: { commentQueryKeys.contains($0.name.lowercased()) }) != true else {
            return nil
        }

        let segments = components.percentEncodedPath.split(separator: "/", omittingEmptySubsequences: true)
        guard segments.count == 2,
              let kind = String(segments[0]).removingPercentEncoding?.lowercased(),
              internalPostPathKinds.contains(kind),
              let postID = String(segments[1]).removingPercentEncoding,
              (1...64).contains(postID.utf8.count),
              postID.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
            return nil
        }
        return postID
    }

    static func safeHTTPSURL(_ value: String) -> URL? {
        guard !value.isEmpty,
              value == value.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains),
              value.range(of: #"%(?![0-9A-Fa-f]{2})"#, options: .regularExpression) == nil,
              let components = URLComponents(string: value),
              components.scheme?.lowercased() == "https",
              let host = components.host,
              !host.isEmpty,
              components.user == nil,
              components.password == nil,
              components.port.map({ (0...65_535).contains($0) }) ?? true,
              let url = components.url,
              url.host != nil else {
            return nil
        }
        return url
    }

    static func attributedText(_ text: String) -> AttributedString {
        let source = text as NSString
        guard let detector = try? NSRegularExpression(pattern: #"https://[^\s<>\"']+"#, options: [.caseInsensitive]) else {
            return AttributedString(text)
        }

        var output = AttributedString()
        var cursor = text.startIndex
        let trailingPunctuation = CharacterSet(charactersIn: ".,!?:;)]}")

        for match in detector.matches(in: text, range: NSRange(location: 0, length: source.length)) {
            let candidate = source.substring(with: match.range)
            let safeCandidate = candidate.trimmingCharacters(in: trailingPunctuation)
            guard let url = safeHTTPSURL(safeCandidate),
                  let sourceRange = text.range(of: safeCandidate, range: Range(match.range, in: text)) else {
                continue
            }

            output.append(AttributedString(text[cursor..<sourceRange.lowerBound]))
            var linkText = AttributedString(text[sourceRange])
            linkText.link = url
            output.append(linkText)
            cursor = sourceRange.upperBound
        }

        output.append(AttributedString(text[cursor...]))
        return output
    }
}
