import SwiftUI

enum TextPostValidation {
    static let maximumLength = 2_200

    static func error(for text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "Write something before posting." }
        if trimmed.utf16.count > maximumLength { return "Posts can contain up to 2,200 characters." }
        return nil
    }
}

struct TextPostComposerView: View {
    @Environment(SessionModel.self) private var session
    @FocusState private var isFocused: Bool
    @State private var text = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var createdPostID: String?
    @State private var idempotencyKey: String?

    let onPublished: () -> Void
    let onSignInRequired: () -> Void

    private var trimmedText: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var characterCountColor: Color {
        text.utf16.count > TextPostValidation.maximumLength ? .red : .secondary
    }

    var body: some View {
        Group {
            if createdPostID != nil {
                successView
            } else if session.phase != .signedIn {
                ContentUnavailableView {
                    Label("Sign in to post", systemImage: "person.crop.circle.badge.plus")
                } description: {
                    Text("Your post will be published to your Nantty account.")
                } actions: {
                    Button("Open Account", systemImage: "person.crop.circle") { onSignInRequired() }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                composer
            }
        }
        .navigationTitle("Create post")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var composer: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Share an update")
                    .font(.largeTitle.bold())
                TextEditor(text: $text)
                    .focused($isFocused)
                    .frame(minHeight: 180)
                    .padding(8)
                    .overlay {
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(.quaternary, lineWidth: 1)
                            .allowsHitTesting(false)
                    }
                    .accessibilityLabel("Post text")
                    .accessibilityIdentifier("text-post-editor")
                    .disabled(isSubmitting)
                    .onChange(of: text) { _, _ in
                        if !isSubmitting {
                            idempotencyKey = nil
                            errorMessage = nil
                        }
                    }

                HStack {
                    Text("Text post · Everyone")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("\(text.utf16.count)/\(TextPostValidation.maximumLength)")
                        .font(.footnote.monospacedDigit())
                        .foregroundStyle(characterCountColor)
                        .accessibilityLabel("\(text.utf16.count) of 2,200 characters")
                }

                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.circle")
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityIdentifier("text-post-error")
                }

                Button(action: submit) {
                    HStack {
                        if isSubmitting { ProgressView().tint(.white) }
                        Text(isSubmitting ? "Posting…" : "Post")
                    }
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSubmitting || TextPostValidation.error(for: text) != nil)
                .accessibilityIdentifier("text-post-submit")
            }
            .frame(maxWidth: 560, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .top)
            .padding(24)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var successView: some View {
        ContentUnavailableView {
            Label("Your post is live", systemImage: "checkmark.circle.fill")
                .foregroundStyle(.green)
        } description: {
            Text("Post created successfully.")
        } actions: {
            Button("Back to feed", systemImage: "house") { onPublished() }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("text-post-back-to-feed")
        }
        .accessibilityIdentifier("text-post-success")
    }

    private func submit() {
        guard !isSubmitting, TextPostValidation.error(for: text) == nil else { return }
        isFocused = false
        isSubmitting = true
        errorMessage = nil
        let key = idempotencyKey ?? UUID().uuidString.lowercased()
        idempotencyKey = key
        Task {
            defer { isSubmitting = false }
            do {
                createdPostID = try await session.submitTextPost(text: trimmedText, idempotencyKey: key)
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
