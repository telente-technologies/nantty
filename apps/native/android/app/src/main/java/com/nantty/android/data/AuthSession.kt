package com.nantty.android.data

data class AccountUser(
    val id: String,
    val name: String,
    val username: String,
    val email: String?,
    val avatarUrl: String?,
    val roles: List<String>,
)

data class AccountSession(
    val accessToken: String,
    val refreshToken: String,
    val user: AccountUser,
)

data class SessionTokens(val accessToken: String, val refreshToken: String)

fun parseAccountSession(payload: Map<String, Any?>): AccountSession? {
    val data = payload["data"] as? Map<*, *> ?: payload
    val accessToken = data["accessToken"] as? String
    val refreshToken = data["refreshToken"] as? String
    val userMap = data["user"] as? Map<*, *> ?: return null
    val id = userMap["id"] as? String
    val name = userMap["name"] as? String
    val username = userMap["username"] as? String
    if (accessToken.isNullOrBlank() || refreshToken.isNullOrBlank() || id.isNullOrBlank() || name.isNullOrBlank() || username.isNullOrBlank()) return null
    val roles = (userMap["roles"] as? List<*>)?.filterIsInstance<String>().orEmpty()
    return AccountSession(
        accessToken = accessToken,
        refreshToken = refreshToken,
        user = AccountUser(
            id = id,
            name = name,
            username = username,
            email = (userMap["email"] as? String)?.takeIf(String::isNotBlank),
            avatarUrl = safeMediaUrl(userMap["avatarUrl"] as? String),
            roles = roles,
        ),
    )
}

fun rotatedSession(session: AccountSession, tokens: SessionTokens): AccountSession? {
    if (tokens.accessToken.isBlank() || tokens.refreshToken.isBlank()) return null
    return session.copy(accessToken = tokens.accessToken, refreshToken = tokens.refreshToken)
}
