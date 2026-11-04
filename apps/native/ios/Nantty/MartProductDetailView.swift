import SwiftUI

struct MartProductDetailView: View {
    let productId: String

    @AppStorage("apiBaseURL") private var apiBaseURL = Bundle.main.object(forInfoDictionaryKey: "NanttyAPIBaseURL") as? String ?? "https://api.nantty.com"
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var detail: MartProductDetail?
    @State private var errorMessage: String?
    @State private var isLoading = true
    @State private var retryKey = UUID()
    @State private var requestKey = UUID()

    var body: some View {
        Group {
            if isLoading && detail == nil {
                ProgressView("Loading product…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage, detail == nil {
                ContentUnavailableView {
                    Label("Product unavailable", systemImage: "bag")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("Try Again", systemImage: "arrow.clockwise") {
                        retryKey = UUID()
                    }
                }
            } else if let detail {
                productContent(detail)
            }
        }
        .navigationTitle("Product")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: retryKey) { await loadProduct() }
        .onDisappear { requestKey = UUID() }
        .accessibilityIdentifier("mart-product-detail")
    }

    @ViewBuilder
    private func productContent(_ product: MartProductDetail) -> some View {
        ScrollView {
            Group {
                if horizontalSizeClass == .regular {
                    HStack(alignment: .top, spacing: 28) {
                        gallery(product)
                            .frame(maxWidth: 520)
                        information(product)
                            .frame(maxWidth: 440, alignment: .leading)
                    }
                    .frame(maxWidth: 1040, alignment: .center)
                    .padding(.horizontal, 28)
                } else {
                    VStack(alignment: .leading, spacing: 20) {
                        gallery(product)
                        information(product)
                    }
                    .padding(.horizontal, 18)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
        }
        .refreshable { await loadProduct() }
    }

    private func gallery(_ product: MartProductDetail) -> some View {
        Group {
            if product.images.isEmpty {
                Image(systemName: "bag")
                    .font(.largeTitle)
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 300)
                    .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22))
                    .accessibilityLabel("No product photos")
            } else {
                ScrollView(.horizontal) {
                    HStack(spacing: 12) {
                        ForEach(product.images.indices, id: \.self) { index in
                            let url = product.images[index]
                            AsyncImage(url: url) { phase in
                                if let image = phase.image {
                                    image.resizable().scaledToFill()
                                } else if phase.error != nil {
                                    Image(systemName: "photo")
                                        .font(.largeTitle)
                                        .foregroundStyle(.tertiary)
                                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                                } else {
                                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                                }
                            }
                            .containerRelativeFrame(.horizontal) { width, _ in
                                min(max(width - 36, 240), 520)
                            }
                            .containerRelativeFrame(.vertical) { height, _ in
                                min(max(height * 0.42, 220), 520)
                            }
                            .background(Color(uiColor: .secondarySystemGroupedBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                            .accessibilityLabel("\(product.title), photo \(index + 1) of \(product.images.count)")
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
        }
    }

    private func information(_ product: MartProductDetail) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(product.title)
                .font(.title2.weight(.bold))
                .accessibilityAddTraits(.isHeader)
            Text(MartProductPresentation.price(product.price))
                .font(.title3.weight(.semibold))
            Label(product.stock > 0 ? "In stock" : "Out of stock", systemImage: product.stock > 0 ? "checkmark.circle" : "xmark.circle")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            if product.rating > 0 {
                Label(String(format: "%.1f customer rating", product.rating), systemImage: "star")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if let promo = product.promo, !promo.isEmpty {
                Text(promo).font(.subheadline.weight(.semibold)).foregroundStyle(.tint)
            }
            if !product.sizes.isEmpty { detailLine("Sizes", product.sizes.joined(separator: " · ")) }
            if !product.colors.isEmpty { detailLine("Colors", product.colors.joined(separator: " · ")) }
            detailLine("Shipping", product.shippingInfo.isEmpty ? "Shipping details are provided at checkout." : product.shippingInfo)
            if !product.description.isEmpty { detailLine("About this product", product.description) }
            Divider().padding(.vertical, 2)
            Label {
                VStack(alignment: .leading, spacing: 3) {
                    Text(product.store.name).font(.headline)
                    if product.store.ratingCount > 0 {
                        Text("\(String(format: "%.1f", product.store.rating)) · \(product.store.ratingCount) ratings")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            } icon: {
                storeImage(product.store.logoUrl)
            }
            .accessibilityElement(children: .combine)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func storeImage(_ url: URL?) -> some View {
        if let url {
            AsyncImage(url: url) { phase in
                if let image = phase.image { image.resizable().scaledToFill() }
                else { Image(systemName: "storefront") }
            }
            .frame(width: 46, height: 46)
            .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
        } else {
            Image(systemName: "storefront")
                .frame(width: 46, height: 46)
                .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 13))
        }
    }

    private func detailLine(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.headline)
            Text(value).font(.body).foregroundStyle(.secondary)
        }
    }

    @MainActor
    private func loadProduct() async {
        let key = UUID()
        requestKey = key
        isLoading = true
        errorMessage = nil
        do {
            let loaded = try await MartCatalogAPI(baseURL: apiBaseURL).fetchProductDetail(id: productId)
            guard requestKey == key else { return }
            detail = loaded
        } catch {
            guard requestKey == key else { return }
            errorMessage = error.localizedDescription
        }
        if requestKey == key { isLoading = false }
    }
}
