import SwiftUI
import UIKit
import WidgetKit

enum NanttyColor {
  static let brand = Color("NanttyBrand")
  static let surface = Color("NanttySurface")
  static let text = Color("NanttyText")
  static let muted = Color("NanttyMuted")
  static let seenRing = Color("NanttySeenRing")
  static let live = Color("NanttyLive")
}

enum WidgetFormat {
  static let hiddenAmount = "••••"

  static func amount(_ money: WidgetMoney?, hidden: Bool) -> String {
    guard !hidden, let money else { return hiddenAmount }
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = money.currency
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: Double(money.amountMinor) / 100)) ?? hiddenAmount
  }

  static func compact(_ value: Int) -> String {
    if value >= 1_000_000 { return String(format: "%.1fM", Double(value) / 1_000_000).replacingOccurrences(of: ".0M", with: "M") }
    if value >= 1_000 { return String(format: "%.1fK", Double(value) / 1_000).replacingOccurrences(of: ".0K", with: "K") }
    return String(value)
  }

  static func eta(_ iso: String?) -> String? {
    guard let iso, let date = ISO8601DateFormatter().date(from: iso) else { return nil }
    if Calendar.current.isDateInToday(date) { return "Arrives by \(date.formatted(date: .omitted, time: .shortened))" }
    return "Arrives \(date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)))"
  }
}

struct WidgetHeader: View {
  let title: String
  var body: some View {
    HStack(spacing: 6) {
      Circle().fill(NanttyColor.brand).frame(width: 8, height: 8)
      Text(title).font(.caption.weight(.semibold)).foregroundStyle(NanttyColor.muted).lineLimit(1)
    }
  }
}

struct WidgetMessageView: View {
  let title: String
  let message: String
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      WidgetHeader(title: title)
      Spacer(minLength: 0)
      Text(message).font(.subheadline.weight(.semibold)).foregroundStyle(NanttyColor.text).lineLimit(3)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

struct WidgetStatView: View {
  let label: String
  let value: String
  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(value).font(.title3.weight(.bold)).foregroundStyle(NanttyColor.text).lineLimit(1).minimumScaleFactor(0.6)
      Text(label).font(.caption2).foregroundStyle(NanttyColor.muted).lineLimit(1)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct WidgetAvatarView: View {
  let imageData: Data?
  let size: CGFloat
  let ring: Color
  var body: some View {
    ZStack {
      Circle().stroke(ring, lineWidth: 2.5).frame(width: size + 6, height: size + 6)
      if let imageData, let image = UIImage(data: imageData) {
        Image(uiImage: image).resizable().scaledToFill().frame(width: size, height: size).clipShape(Circle())
      } else {
        Circle().fill(NanttyColor.surface).frame(width: size, height: size)
      }
    }
  }
}

struct WidgetStateView<Payload, Content: View>: View {
  let title: String
  let state: WidgetState<Payload>
  let unavailableMessage: String
  @ViewBuilder let content: (Payload, [String: Data]) -> Content
  var body: some View {
    switch state {
    case .signedOut: WidgetMessageView(title: title, message: "Sign in to Nantty").widgetURL(URL(string: "nantty://"))
    case .unavailable: WidgetMessageView(title: title, message: unavailableMessage)
    case .ready(let payload, let images): content(payload, images)
    }
  }
}

extension View {
  func nanttyWidgetBackground() -> some View {
    containerBackground(for: .widget) { Color("$widgetBackground") }
  }
}
