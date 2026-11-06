package com.nantty.android

import java.net.URI

/** Validates channel invitation links independently from the group E2EE invitation route. */
internal object ChannelInvitationDeepLink {
    private val tokenPattern = Regex("^[A-Za-z0-9_-]{43}$")

    fun tokenFrom(rawUrl: String?, trustedWebHost: String = "web.nantty.com"): String? {
        if (rawUrl.isNullOrBlank()) return null
        val uri = runCatching { URI(rawUrl) }.getOrNull() ?: return null
        if (uri.rawQuery != null || uri.rawFragment != null || uri.rawUserInfo != null || uri.port != -1) return null
        val token = when {
            uri.scheme.equals("https", true) && uri.host.equals(trustedWebHost, true) ->
                uri.path?.removePrefix("/channels/invitations/")?.takeIf { uri.path == "/channels/invitations/$it" && '/' !in it }
            uri.scheme.equals("nantty", true) && uri.host == "channels" ->
                uri.path?.removePrefix("/invitations/")?.takeIf { uri.path == "/invitations/$it" && '/' !in it }
            else -> null
        }
        return token?.takeIf(tokenPattern::matches)
    }

    fun shareUrl(webAppBaseUrl: String, token: String): String? {
        if (!tokenPattern.matches(token)) return null
        val base = runCatching { URI(webAppBaseUrl) }.getOrNull() ?: return null
        if (!base.scheme.equals("https", true) || base.host.isNullOrBlank() || base.rawUserInfo != null ||
            base.port != -1 || base.rawQuery != null || base.rawFragment != null || base.path !in listOf("", "/") ||
            !(base.host.equals("nantty.com", true) || base.host.endsWith(".nantty.com", true))
        ) return null
        return "${base.scheme}://${base.host}/channels/invitations/$token"
    }
}
