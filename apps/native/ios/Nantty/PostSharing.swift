import SwiftUI
import UIKit

enum PostShareMessage {
    static func make(authorName: String, postID: String, webBaseURL: String) -> String? {
        guard let configuration = APIConfiguration(rawValue: webBaseURL),
              var components = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false) else {
            return nil
        }

        let basePath = components.percentEncodedPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let encodedPostID = PostThreadService.pathSegment(postID)
        guard !encodedPostID.isEmpty else { return nil }
        components.percentEncodedPath = "/" + [basePath, "post", encodedPostID].filter { !$0.isEmpty }.joined(separator: "/")
        guard let url = components.url else { return nil }
        return "\(authorName) on Nantty: \(url.absoluteString)"
    }
}

enum PostShareCompletion {
    static func recordIfCompleted(_ completed: Bool, record: () -> Void) {
        if completed { record() }
    }
}

struct PostShareButton: View {
    let authorName: String
    let postID: String
    let count: Int?
    let onCompletedShare: () -> Void

    @State private var isPresenting = false

    private var message: String? {
        let baseURL = Bundle.main.object(forInfoDictionaryKey: "NanttyWebAppBaseURL") as? String
            ?? "https://web.nantty.com"
        return PostShareMessage.make(authorName: authorName, postID: postID, webBaseURL: baseURL)
    }

    var body: some View {
        Button {
            guard message != nil else { return }
            isPresenting = true
        } label: {
            if let count {
                Label(count.formatted(), systemImage: "square.and.arrow.up")
            } else {
                Label("Share", systemImage: "square.and.arrow.up")
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(count.map { "Share post, \($0) shares" } ?? "Share post")
        .accessibilityIdentifier("post-share-\(postID)")
        .disabled(message == nil)
        .sheet(isPresented: $isPresenting) {
            if let message {
                SystemPostShareSheet(message: message) { completed in
                    PostShareCompletion.recordIfCompleted(completed, record: onCompletedShare)
                    isPresenting = false
                }
                .ignoresSafeArea()
            }
        }
    }
}

private struct SystemPostShareSheet: UIViewControllerRepresentable {
    let message: String
    let onCompletion: (Bool) -> Void

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: [message], applicationActivities: nil)
        controller.completionWithItemsHandler = { _, completed, _, _ in
            DispatchQueue.main.async { onCompletion(completed) }
        }
        return controller
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
