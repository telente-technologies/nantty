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
