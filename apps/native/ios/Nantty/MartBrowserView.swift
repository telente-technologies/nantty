import SwiftUI

struct MartBrowserView: View {
    let onOpenProduct: (String) -> Void

    @AppStorage("apiBaseURL") private var apiBaseURL = Bundle.main.object(forInfoDictionaryKey: "NanttyAPIBaseURL") as? String ?? "http://localhost:8080"
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var categories: [MartCategory] = []
    @State private var products: [MartProduct] = []
    @State private var selectedCategoryId: String?
    @State private var nextCursor: String?
    @State private var isLoading = true
    @State private var isLoadingMore = false
    @State private var errorMessage: String?
    @State private var pageError: String?
    @State private var requestID = UUID()

    private var columns: [GridItem] {
        Array(
            repeating: GridItem(.flexible(), spacing: 14, alignment: .top),
            count: MartGridLayout.columnCount(
                isCompactWidth: horizontalSizeClass != .regular,
                isAccessibilityTextSize: dynamicTypeSize.isAccessibilitySize
            )
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Good finds, from real stores.")
                        .font(.title2.weight(.bold))
                    Text("Browse products from sellers on Nantty.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal)
                .frame(maxWidth: .infinity, alignment: .leading)

                if !categories.isEmpty {
                    categoryPicker
                }

                if isLoading && products.isEmpty {
                    ProgressView("Loading products…")
                        .frame(maxWidth: .infinity, minHeight: 220)
                } else if let errorMessage, products.isEmpty {
                    ContentUnavailableView {
                        Label("Mart unavailable", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(errorMessage)
                    } actions: {
                        Button("Try Again", systemImage: "arrow.clockwise") { Task { await loadFirstPage() } }
                    }
                    .frame(minHeight: 260)
                } else if products.isEmpty {
                    ContentUnavailableView("No products here yet", systemImage: "bag", description: Text("Try another category or check back later."))
                        .frame(minHeight: 260)
                } else {
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 20) {
                        ForEach(products) { product in
                            MartProductCard(product: product) {
                                onOpenProduct(product.id)
                            }
                        }
                    }
                    .padding(.horizontal)

                    if let pageError {
                        VStack(spacing: 8) {
                            Text(pageError).font(.footnote).foregroundStyle(.secondary)
                            Button("Retry loading more") { Task { await loadMore() } }
                        }
                        .frame(maxWidth: .infinity)
                    } else if isLoadingMore {
                        ProgressView("Loading more products…")
                            .frame(maxWidth: .infinity)
                    } else if nextCursor != nil {
                        Button("Load more", systemImage: "arrow.down") { Task { await loadMore() } }
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding(.vertical, 16)
            .frame(maxWidth: 900)
            .frame(maxWidth: .infinity)
        }
        .refreshable { await loadFirstPage() }
        .task { await loadHomeAndProducts() }
        .accessibilityIdentifier("mart-browser")
    }

    private var categoryPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                categoryButton(title: "All", id: nil)
                ForEach(categories) { category in
                    categoryButton(title: category.name, id: category.id)
                }
            }
            .padding(.horizontal)
        }
        .accessibilityLabel("Product categories")
    }

    private func categoryButton(title: String, id: String?) -> some View {
        let selected = selectedCategoryId == id
        return Button {
            guard selectedCategoryId != id else { return }
            selectedCategoryId = id
            Task { await loadFirstPage() }
        } label: {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 15)
                .padding(.vertical, 10)
                .foregroundStyle(selected ? Color.white : Color.primary)
                .background(selected ? Color.accentColor : Color(uiColor: .secondarySystemGroupedBackground), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    @MainActor
    private func loadHomeAndProducts() async {
        do {
            let home = try await MartCatalogAPI(baseURL: apiBaseURL).fetchHome()
            categories = home.categories
        } catch {
            // Product discovery remains available even if category metadata is temporarily unavailable.
        }
        await loadFirstPage()
    }

    @MainActor
    private func loadFirstPage() async {
        let id = UUID()
        requestID = id
        isLoading = true
        isLoadingMore = false
        pageError = nil
        errorMessage = nil
        products = []
        nextCursor = nil
        do {
            let page = try await MartCatalogAPI(baseURL: apiBaseURL).fetchProducts(categoryId: selectedCategoryId)
            guard requestID == id else { return }
            products = page.data
            nextCursor = page.nextCursor
        } catch {
            guard requestID == id else { return }
            errorMessage = error.localizedDescription
        }
        if requestID == id { isLoading = false }
    }

    @MainActor
    private func loadMore() async {
        guard !isLoading, !isLoadingMore, let cursor = nextCursor else { return }
        let id = requestID
        isLoadingMore = true
        pageError = nil
        do {
            let page = try await MartCatalogAPI(baseURL: apiBaseURL).fetchProducts(categoryId: selectedCategoryId, cursor: cursor)
            guard requestID == id else { return }
            products = MartProductsPage.appending(page.data, to: products)
            nextCursor = page.nextCursor
        } catch {
            guard requestID == id else { return }
            pageError = error.localizedDescription
        }
        if requestID == id { isLoadingMore = false }
    }
}

private struct MartProductCard: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let product: MartProduct
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 8) {
                AsyncImage(url: product.imageUrl) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else if phase.error != nil {
                        imagePlaceholder
                    } else {
                        ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
                .frame(height: 160)
                .frame(maxWidth: .infinity)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                Text(product.name)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
                    .foregroundStyle(.primary)
                Text(MartProductPresentation.price(product.price))
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.primary)
                if product.stock == 0 {
                    Text("Out of stock").font(.caption).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(product.name), \(MartProductPresentation.price(product.price))")
        .accessibilityHint("Opens product details")
    }

    private var imagePlaceholder: some View {
        Image(systemName: "bag")
            .font(.title2)
            .foregroundStyle(.tertiary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityHidden(true)
    }

}
