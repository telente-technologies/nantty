import SwiftUI

struct MyProfileView: View {
    @Environment(SessionModel.self) private var session
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    let onSignInRequired: () -> Void

    @State private var profile: MyProfile?
    @State private var name = ""
    @State private var bio = ""
    @State private var isPrivate = false
    @State private var isEditing = false
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var statusMessage: String?

    var body: some View {
        Group {
            if session.phase != .signedIn {
                signedOutState
            } else if isLoading && profile == nil {
                ProgressView("Loading your profile…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let profile {
                profileContent(profile)
            } else {
                unavailableState
            }
        }
        .navigationTitle("Profile")
        .task(id: session.phase) {
            if session.phase == .signedIn, profile == nil { await loadProfile() }
        }
    }

    private var signedOutState: some View {
        ContentUnavailableView {
            Label("Sign in to view your profile", systemImage: "person.crop.circle")
        } description: {
            Text("Your profile is available after you sign in.")
        } actions: {
            Button("Sign in", systemImage: "arrow.right.to.line", action: onSignInRequired)
                .buttonStyle(.borderedProminent)
        }
    }

    private var unavailableState: some View {
        ContentUnavailableView {
            Label("Profile unavailable", systemImage: "person.crop.circle.badge.exclamationmark")
        } description: {
            Text(errorMessage ?? "Check your connection, then try again.")
        } actions: {
            Button("Try Again", systemImage: "arrow.clockwise") { Task { await loadProfile() } }
                .buttonStyle(.borderedProminent)
        }
    }

    private func profileContent(_ profile: MyProfile) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack(alignment: .firstTextBaseline) {
                    Text(isEditing ? "Edit profile" : "Your profile")
                        .font(.title2.weight(.semibold))
                    Spacer()
                    if isEditing {
                        Button("Cancel", action: cancelEditing)
                            .disabled(isSaving)
                    } else {
                        Button("Edit", systemImage: "pencil") { beginEditing(profile) }
                            .accessibilityIdentifier("edit-profile")
                    }
                }

                profileBanner(profile)

                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .top, spacing: 28) {
                        identityColumn(profile)
                            .frame(maxWidth: 250, alignment: .leading)
                        detailsColumn(profile)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    VStack(alignment: .leading, spacing: 24) {
                        identityColumn(profile)
                        detailsColumn(profile)
                    }
                }

                if let statusMessage {
                    Label(statusMessage, systemImage: "checkmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .accessibilityIdentifier("profile-status")
                }
                if let errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.circle")
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: horizontalSizeClass == .regular ? 760 : 520, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .top)
            .padding(24)
        }
        .refreshable { await loadProfile() }
        .scrollDismissesKeyboard(.interactively)
    }

    private func identityColumn(_ profile: MyProfile) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            profileAvatar(profile)
            Text(profile.name)
                .font(.title3.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
            Text("@\(profile.username)")
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
            if !isEditing {
                Text(profile.bio.isEmpty ? "Add a short bio to tell people about yourself." : profile.bio)
                    .foregroundStyle(profile.bio.isEmpty ? .secondary : .primary)
                    .fixedSize(horizontal: false, vertical: true)
                if let website = profile.website, !website.isEmpty {
                    Text(website)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            }
            HStack(spacing: 18) {
                metric(profile.followers, title: "Followers")
                metric(profile.following, title: "Following")
                metric(profile.posts, title: "Posts")
            }
            .padding(.top, 8)
            .accessibilityElement(children: .combine)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func profileBanner(_ profile: MyProfile) -> some View {
        ZStack {
            Rectangle().fill(Color(uiColor: .secondarySystemBackground))
            if let url = profile.displayBannerURL {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        bannerFallback
                    }
                }
            } else {
                bannerFallback
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 142)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Cover photo for \(profile.name)")
    }

    private var bannerFallback: some View {
        Image(systemName: "person.crop.rectangle")
            .font(.title2)
            .foregroundStyle(.tertiary)
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private func profileAvatar(_ profile: MyProfile) -> some View {
        Group {
            if let url = profile.displayAvatarURL {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        avatarFallback
                    }
                }
            } else {
                avatarFallback
            }
        }
        .frame(width: 64, height: 64)
        .clipShape(Circle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Profile photo for \(profile.name)")
    }

    private var avatarFallback: some View {
        Image(systemName: "person.crop.circle.fill")
            .font(.system(size: 64, weight: .regular))
            .foregroundStyle(.tint)
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private func detailsColumn(_ profile: MyProfile) -> some View {
        if isEditing {
            VStack(alignment: .leading, spacing: 18) {
                TextField("Display name", text: $name)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.name)
                    .onChange(of: name) { _, value in
                        if value.unicodeScalars.count > 50 { name = String(value.unicodeScalars.prefix(50)) }
                    }
                    .accessibilityLabel("Display name")
                VStack(alignment: .leading, spacing: 6) {
                    Text("Bio").font(.subheadline.weight(.medium))
                    TextEditor(text: $bio)
                        .frame(minHeight: 110)
                        .padding(6)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(.quaternary))
                        .onChange(of: bio) { _, value in
                            if value.unicodeScalars.count > 160 { bio = String(value.unicodeScalars.prefix(160)) }
                        }
                        .accessibilityLabel("Bio")
                    Text("\(bio.unicodeScalars.count)/160")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
                Toggle("Private profile", isOn: $isPrivate)
                Text("Only approved followers can see your posts when your profile is private.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button(action: saveProfile) {
                    HStack {
                        if isSaving { ProgressView() }
                        Text(isSaving ? "Saving…" : "Save changes")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSaving)
                .accessibilityIdentifier("save-profile")
            }
        } else {
            VStack(alignment: .leading, spacing: 16) {
                LabeledContent("Profile visibility", value: profile.isPrivate ? "Private" : "Public")
                if profile.isPrivate {
                    Label("Only approved followers can see your posts.", systemImage: "lock")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func metric(_ value: Int, title: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value.formatted())
                .font(.headline.monospacedDigit())
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }

    private func beginEditing(_ profile: MyProfile) {
        name = profile.name
        bio = profile.bio
        isPrivate = profile.isPrivate
        statusMessage = nil
        errorMessage = nil
        isEditing = true
    }

    private func cancelEditing() {
        guard let profile else { return }
        beginEditing(profile)
        isEditing = false
    }

    private func loadProfile() async {
        guard session.phase == .signedIn, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let loaded = try await session.fetchMyProfile()
            profile = loaded
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func saveProfile() {
        guard MyProfileFormValidation.message(name: name, bio: bio) == nil else {
            errorMessage = MyProfileFormValidation.message(name: name, bio: bio)
            return
        }
        let update = MyProfileUpdate(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            bio: bio.trimmingCharacters(in: .whitespacesAndNewlines),
            isPrivate: isPrivate
        )
        let previouslyLoadedProfile = profile
        isSaving = true
        errorMessage = nil
        statusMessage = nil
        Task {
            defer { isSaving = false }
            do {
                let savedProfile = try await session.updateMyProfile(update)
                profile = MyProfile(
                    name: savedProfile.name,
                    username: savedProfile.username,
                    bio: savedProfile.bio,
                    website: savedProfile.website,
                    followers: previouslyLoadedProfile?.followers ?? savedProfile.followers,
                    following: previouslyLoadedProfile?.following ?? savedProfile.following,
                    posts: previouslyLoadedProfile?.posts ?? savedProfile.posts,
                    isPrivate: savedProfile.isPrivate,
                    avatarUrl: savedProfile.avatarUrl ?? previouslyLoadedProfile?.avatarUrl,
                    bannerUrl: savedProfile.bannerUrl ?? previouslyLoadedProfile?.bannerUrl
                )
                isEditing = false
                statusMessage = "Profile updated."
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
