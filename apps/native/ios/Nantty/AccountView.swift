import SwiftUI

struct AccountView: View {
    @Environment(SessionModel.self) private var session
    @FocusState private var focusedField: Field?
    @State private var identifier = ""
    @State private var password = ""

    private enum Field {
        case identifier
        case password
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                switch session.phase {
                case .restoring:
                    ProgressView("Restoring your secure session…")
                        .frame(maxWidth: .infinity, minHeight: 180)
                case .signedIn:
                    signedInContent
                case .signedOut:
                    signInForm
                case .restoreUnavailable:
                    restoreFailure
                }

                if let message = session.message {
                    Label(message, systemImage: "exclamationmark.circle")
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: 480, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .top)
            .padding(24)
        }
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Account")
    }

    private var signInForm: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Welcome back")
                    .font(.largeTitle.bold())
                Text("Sign in to your Nantty account.")
                    .foregroundStyle(.secondary)
            }

            TextField("Email or username", text: $identifier)
                .textContentType(.username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.emailAddress)
                .submitLabel(.next)
                .focused($focusedField, equals: .identifier)
                .onSubmit { focusedField = .password }
                .accessibilityLabel("Email or username")

            SecureField("Password", text: $password)
                .textContentType(.password)
                .submitLabel(.go)
                .focused($focusedField, equals: .password)
                .onSubmit { submit() }
                .accessibilityLabel("Password")

            Button(action: submit) {
                HStack {
                    if session.isWorking { ProgressView().tint(.white) }
                    Text(session.isWorking ? "Signing in…" : "Sign in")
                }
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
            }
            .buttonStyle(.borderedProminent)
            .disabled(session.isWorking)
            .accessibilityIdentifier("sign-in-button")
        }
        .textFieldStyle(.roundedBorder)
    }

    private var signedInContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Signed in", systemImage: "checkmark.circle.fill")
                .font(.title2.weight(.semibold))
                .foregroundStyle(.green)
            if let user = session.user {
                Text(user.name)
                    .font(.title3.weight(.semibold))
                Text("@\(user.username)")
                    .foregroundStyle(.secondary)
                if let email = user.email {
                    Text(email).foregroundStyle(.secondary)
                }
            }
            Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) {
                Task { await session.signOut() }
            }
            .buttonStyle(.bordered)
            .disabled(session.isWorking)
        }
    }

    private var restoreFailure: some View {
        ContentUnavailableView {
            Label("Can’t restore session", systemImage: "person.crop.circle.badge.exclamationmark")
        } description: {
            Text("Your saved sign-in remains protected on this device. Check your connection, then try again.")
        } actions: {
            Button("Try Again", systemImage: "arrow.clockwise") {
                Task { await session.restoreSession() }
            }
            .buttonStyle(.borderedProminent)
            Button("Use Another Account", role: .destructive) {
                Task { await session.useAnotherAccount() }
            }
            .buttonStyle(.bordered)
        }
    }

    private func submit() {
        focusedField = nil
        Task { await session.signIn(identifier: identifier, password: password) }
    }
}
