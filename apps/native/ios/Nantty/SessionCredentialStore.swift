import Foundation
import Security

protocol SessionCredentialStoring {
    func load() throws -> SessionTokens?
    func save(_ tokens: SessionTokens) throws
    func clear() throws
}

enum SessionCredentialStoreError: Error {
    case keychainStatus(OSStatus)
    case unreadableCredentials
}

struct KeychainSessionCredentialStore: SessionCredentialStoring {
    private let service = "com.nantty.app.session"
    private let account = "current-session"

    func load() throws -> SessionTokens? {
        var result: CFTypeRef?
        var search = query
        search[kSecReturnData as String] = true
        search[kSecMatchLimit as String] = kSecMatchLimitOne
        let status = SecItemCopyMatching(search as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw SessionCredentialStoreError.keychainStatus(status) }
        guard let data = result as? Data,
              let tokens = try? JSONDecoder().decode(SessionTokens.self, from: data) else {
            throw SessionCredentialStoreError.unreadableCredentials
        }
        return tokens
    }

    func save(_ tokens: SessionTokens) throws {
        let data = try JSONEncoder().encode(tokens)
        let update = [kSecValueData as String: data]
        let status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if status == errSecSuccess { return }
        guard status == errSecItemNotFound else { throw SessionCredentialStoreError.keychainStatus(status) }

        var insertion = query
        insertion[kSecValueData as String] = data
        insertion[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let insertionStatus = SecItemAdd(insertion as CFDictionary, nil)
        guard insertionStatus == errSecSuccess else {
            throw SessionCredentialStoreError.keychainStatus(insertionStatus)
        }
    }

    func clear() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SessionCredentialStoreError.keychainStatus(status)
        }
    }

    private var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
