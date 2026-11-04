enum OrdersOverviewMetadataLayout: Equatable {
    case stacked
    case fit

    static func resolve(isCompactWidth: Bool, isAccessibilityTextSize: Bool) -> Self {
        isCompactWidth || isAccessibilityTextSize ? .stacked : .fit
    }
}
