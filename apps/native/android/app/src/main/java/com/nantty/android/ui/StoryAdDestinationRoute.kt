package com.nantty.android.ui

import com.nantty.android.data.StoryAdDestination
import java.net.URI

/** A validated in-app action derived from the server's story-ad destination contract. */
internal sealed interface StoryAdDestinationRoute {
    data class Product(val id: String) : StoryAdDestinationRoute
    data class Store(val id: String) : StoryAdDestinationRoute
    data class Post(val id: String) : StoryAdDestinationRoute
    data class Profile(val id: String) : StoryAdDestinationRoute
    data object Messages : StoryAdDestinationRoute
    data class External(val uri: URI) : StoryAdDestinationRoute
}

internal fun StoryAdDestination.toRoute(): StoryAdDestinationRoute? = when (type) {
    "product" -> targetId.nonBlank()?.let(StoryAdDestinationRoute::Product)
    "store" -> targetId.nonBlank()?.let(StoryAdDestinationRoute::Store)
    "post" -> targetId.nonBlank()?.let(StoryAdDestinationRoute::Post)
    "profile" -> targetId.nonBlank()?.let(StoryAdDestinationRoute::Profile)
    "messages" -> StoryAdDestinationRoute.Messages
    "url", "app_store" -> url?.let(::trustedExternalStoryDestination)?.let(StoryAdDestinationRoute::External)
    else -> null
}

internal fun dispatchStoryAdDestination(
    destination: StoryAdDestination,
    onProduct: (String) -> Unit,
    onStore: (String) -> Unit,
    onPost: (String) -> Unit,
    onProfile: (String) -> Unit,
    onMessages: () -> Unit,
    onExternal: (URI) -> Unit,
) {
    when (val route = destination.toRoute()) {
        is StoryAdDestinationRoute.Product -> onProduct(route.id)
        is StoryAdDestinationRoute.Store -> onStore(route.id)
        is StoryAdDestinationRoute.Post -> onPost(route.id)
        is StoryAdDestinationRoute.Profile -> onProfile(route.id)
        StoryAdDestinationRoute.Messages -> onMessages()
        is StoryAdDestinationRoute.External -> onExternal(route.uri)
        null -> Unit
    }
}

private fun String?.nonBlank(): String? = this?.takeIf(String::isNotBlank)

private fun trustedExternalStoryDestination(raw: String): URI? = runCatching {
    URI(raw.trim()).takeIf {
        it.isAbsolute && it.scheme.equals("https", ignoreCase = true) &&
            !it.host.isNullOrBlank() && it.rawUserInfo == null && it.fragment == null &&
            it.toASCIIString().length <= MAX_STORY_DESTINATION_URL_LENGTH
    }
}.getOrNull()

private const val MAX_STORY_DESTINATION_URL_LENGTH = 4_096
