import SwiftUI

struct APISettingsView: View {
    @AppStorage("apiBaseURL")
    private var apiBaseURL = Bundle.main.object(forInfoDictionaryKey: "NanttyAPIBaseURL") as? String ?? "http://localhost:8080"

    private var validationMessage: String? {
        guard !apiBaseURL.isEmpty else { return nil }
        guard APIConfiguration(rawValue: apiBaseURL) != nil else {
            return "Use HTTPS. Release builds allow only the configured API origin; HTTP is limited to loopback in Debug."
        }
        return nil
    }

    var body: some View {
        Form {
            Section {
                TextField("https://api.example.com", text: $apiBaseURL)
                    .textContentType(.URL)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .accessibilityLabel("Backend API base URL")
                if let validationMessage {
                    Text(validationMessage)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .accessibilityLabel("Invalid API URL. \(validationMessage)")
                }
            } header: {
                Text("Backend")
            } footer: {
                Text("Used as the base address for Nantty API requests, including the public For You feed.")
            }

            Section("Widget") {
                Text("The Orders widget never contacts the backend. While signed in, Nantty refreshes it and shares a small, private order summary with the widget extension.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .onAppear(perform: syncWidgetState)
        .onChange(of: apiBaseURL) { _, _ in syncWidgetState() }
    }

    private func syncWidgetState() {
        SharedAppGroup.defaults?.set(APIConfiguration(rawValue: apiBaseURL) != nil, forKey: "apiConfigured")
    }
}
