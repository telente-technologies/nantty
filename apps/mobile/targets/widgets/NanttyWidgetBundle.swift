import SwiftUI
import WidgetKit

@main
struct NanttyWidgetBundle: WidgetBundle {
  var body: some Widget {
    NanttyOrdersWidget()
    NanttySellerTodayWidget()
    NanttyLiveNowWidget()
    NanttyCreatorTodayWidget()
    NanttyStoriesWidget()
  }
}
