package com.nantty.android

import java.net.URI

/** Strict allowlist parser for group invitation URLs. Tokens are opaque 32-byte base64url values. */
internal object GroupInvitationDeepLink {
    private val tokenPattern = Regex("^[A-Za-z0-9_-]{43}$")

    fun tokenFrom(rawUrl: String?, trustedWebHost: String = "web.nantty.com"): String? {
        if (rawUrl.isNullOrBlank()) return null
        val uri = runCatching { URI(rawUrl) }.getOrNull() ?: return null
        if (uri.rawQuery != null || uri.rawFragment != null || uri.rawUserInfo != null || uri.port != -1) return null
        val token = when {
            uri.scheme.equals("https", ignoreCase = true) && uri.host.equals(trustedWebHost, ignoreCase = true) -> {
                uri.path?.removePrefix("/chats/invitations/")?.takeIf { uri.path == "/chats/invitations/$it" && '/' !in it }
            }
            uri.scheme.equals("nantty", ignoreCase = true) && uri.host == "chats" -> {
                uri.path?.removePrefix("/invitations/")?.takeIf { uri.path == "/invitations/$it" && '/' !in it }
            }
            else -> null
        }
        return token?.takeIf(tokenPattern::matches)
    }

    fun shareUrl(webAppBaseUrl: String, token: String): String? {
        if (!tokenPattern.matches(token)) return null
        val base = runCatching { URI(webAppBaseUrl) }.getOrNull() ?: return null
        if (!base.scheme.equals("https", ignoreCase = true) || base.host.isNullOrBlank() ||
            base.rawUserInfo != null || base.port != -1 || base.rawQuery != null || base.rawFragment != null ||
            base.path !in listOf("", "/") || !isNanttyWebHost(base.host)
        ) return null
        return "${base.scheme}://${base.host}/chats/invitations/$token"
    }

    private fun isNanttyWebHost(host: String): Boolean =
        host.equals("nantty.com", ignoreCase = true) || host.endsWith(".nantty.com", ignoreCase = true)
}
