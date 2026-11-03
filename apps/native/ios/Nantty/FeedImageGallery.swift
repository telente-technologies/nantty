import SwiftUI

struct FeedImageGalleryItem: Identifiable, Equatable {
    let id: String
    let url: URL

    static func readyImages(from media: [FeedPost.Media]) -> [FeedImageGalleryItem] {
        media.compactMap { item in
            guard item.type == "image", item.status == "ready", let url = item.url else { return nil }
            return FeedImageGalleryItem(id: item.id, url: url)
        }
    }

    static func readyImages(from media: [ThreadPost.Media]) -> [FeedImageGalleryItem] {
        media.compactMap { item in
            guard let url = item.readyImageURL else { return nil }
            return FeedImageGalleryItem(id: item.id, url: url)
        }
    }
}

enum FeedImageGalleryNavigation {
    static func boundedIndex(_ proposedIndex: Int, count: Int) -> Int? {
        guard count > 0 else { return nil }
        return min(max(proposedIndex, 0), count - 1)
    }

    static func previousIndex(from index: Int, count: Int) -> Int? {
        guard let current = boundedIndex(index, count: count) else { return nil }
        return max(0, current - 1)
    }

    static func nextIndex(from index: Int, count: Int) -> Int? {
        guard let current = boundedIndex(index, count: count) else { return nil }
        return min(count - 1, current + 1)
    }

    static func accessibilityLabel(context: String, index: Int, count: Int) -> String {
        guard let current = boundedIndex(index, count: count) else { return context }
        return "\(context), image \(current + 1) of \(count)"
    }
}

struct FeedImageGalleryViewer: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedIndex: Int

    let images: [FeedImageGalleryItem]
    let context: String

    init(images: [FeedImageGalleryItem], initialIndex: Int, context: String) {
        self.images = images
        self.context = context
        _selectedIndex = State(initialValue: FeedImageGalleryNavigation.boundedIndex(initialIndex, count: images.count) ?? 0)
    }

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                TabView(selection: $selectedIndex) {
                    ForEach(images.indices, id: \.self) { index in
                        let item = images[index]
                        imagePage(item, index: index)
                            .frame(width: geometry.size.width, height: geometry.size.height)
                            .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .accessibilityLabel("Post image gallery")
                .accessibilityValue(Text("Image \(selectedIndex + 1) of \(images.count)"))
                .accessibilityIdentifier("feed-image-gallery-pages")
                .background(Color.black)
            }
            .background(Color.black.ignoresSafeArea())
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Image \(selectedIndex + 1) of \(images.count)")
                        .font(.headline)
                        .foregroundStyle(.primary)
                        .accessibilityIdentifier("feed-image-gallery-position")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                        .accessibilityIdentifier("feed-image-gallery-close")
                }
                ToolbarItemGroup(placement: .bottomBar) {
                    Button {
                        move(to: FeedImageGalleryNavigation.previousIndex(from: selectedIndex, count: images.count))
                    } label: {
                        Label("Previous image", systemImage: "chevron.left")
                    }
                    .disabled(selectedIndex == 0)
                    .accessibilityIdentifier("feed-image-gallery-previous")

                    Spacer()

                    Button {
                        move(to: FeedImageGalleryNavigation.nextIndex(from: selectedIndex, count: images.count))
                    } label: {
                        Label("Next image", systemImage: "chevron.right")
                    }
                    .disabled(selectedIndex >= images.count - 1)
                    .accessibilityIdentifier("feed-image-gallery-next")
                }
            }
        }
        .preferredColorScheme(.dark)
        .presentationBackground(Color.black)
    }

    @ViewBuilder
    private func imagePage(_ item: FeedImageGalleryItem, index: Int) -> some View {
        AsyncImage(url: item.url) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFit()
            case .failure:
                ContentUnavailableView("Image unavailable", systemImage: "photo")
                    .foregroundStyle(.white)
            case .empty:
                ProgressView("Loading image…")
                    .tint(.white)
                    .foregroundStyle(.white)
            @unknown default:
                ContentUnavailableView("Image unavailable", systemImage: "photo")
                    .foregroundStyle(.white)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(FeedImageGalleryNavigation.accessibilityLabel(context: context, index: index, count: images.count))
        .accessibilityIdentifier("feed-image-gallery-image-\(index + 1)")
    }

    private func move(to index: Int?) {
        guard let index else { return }
        selectedIndex = index
    }
}
