import Foundation

struct SessionTokens: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
}

struct SessionUser: Decodable, Equatable, Identifiable {
    let id: String
    let name: String
    let username: String
    let email: String?
    let avatarURL: URL?
    let accountStatus: String?

    private enum CodingKeys: String, CodingKey {
        case id, name, username, email, accountStatus
        case avatarURL = "avatarUrl"
    }
}

struct AuthSession: Decodable, Equatable {
    let accessToken: String
    let refreshToken: String
    let user: SessionUser

    var tokens: SessionTokens {
        SessionTokens(accessToken: accessToken, refreshToken: refreshToken)
    }
}

enum SessionPayloadDecoder {
    private struct DataEnvelope<Value: Decodable>: Decodable {
        let data: Value
    }

    static func decode<Value: Decodable>(_ type: Value.Type, from data: Data) throws -> Value {
        let decoder = JSONDecoder()
        if let direct = try? decoder.decode(type, from: data) {
            return direct
        }
        return try decoder.decode(DataEnvelope<Value>.self, from: data).data
    }
}

enum SignInValidation {
    static func message(identifier: String, password: String) -> String? {
        if identifier.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Enter your email or username."
        }
        if password.isEmpty {
            return "Enter your password."
        }
        return nil
    }
}
