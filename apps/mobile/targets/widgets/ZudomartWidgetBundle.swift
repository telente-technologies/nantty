import SwiftUI
import WidgetKit

@main
struct ZudomartWidgetBundle: WidgetBundle {
  var body: some Widget {
    ZudomartOrdersWidget()
    ZudomartSellerTodayWidget()
    ZudomartLiveNowWidget()
    ZudomartCreatorTodayWidget()
    ZudomartStoriesWidget()
  }
}
