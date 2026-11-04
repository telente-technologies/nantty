enum MartGridLayout {
    static func columnCount(isCompactWidth: Bool, isAccessibilityTextSize: Bool) -> Int {
        if isAccessibilityTextSize {
            return isCompactWidth ? 1 : 2
        }
        return isCompactWidth ? 2 : 3
    }
}
