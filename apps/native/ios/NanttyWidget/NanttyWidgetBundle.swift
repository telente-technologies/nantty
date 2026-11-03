import WidgetKit

@main
struct NanttyWidgetBundle: WidgetBundle {
    var body: some Widget {
        NanttyHomeWidget()
        NanttyQuickActionsWidget()
        NanttyOrdersWidget()
    }
}
