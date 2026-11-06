package com.nantty.android.data

/** Loads the newest authenticated pages first and emits each accumulated history snapshot. */
fun MessagesRepository.loadInitialHistory(
    conversationId: String,
    onPageLoaded: (ChatMessagePage) -> Unit = {},
): ChatHistoryResult {
    var cursor: String? = null
    var accumulated: ChatMessagePage? = null

    repeat(MessagesRepository.MAX_INITIAL_HISTORY_PAGES) {
        when (val loaded = loadMessages(conversationId, cursor)) {
            is ChatHistoryResult.Failure -> {
                val existing = accumulated ?: return loaded
                return ChatHistoryResult.Success(existing, continuationError = loaded.message)
            }
            is ChatHistoryResult.Success -> {
                val previous = accumulated
                val merged = if (previous == null) loaded.page else ChatMessagePage(
                    messages = (previous.messages + loaded.page.messages).distinctBy(EncryptedChatMessage::id),
                    nextCursor = loaded.page.nextCursor,
                )
                accumulated = merged
                onPageLoaded(merged)
                cursor = loaded.page.nextCursor ?: return ChatHistoryResult.Success(merged)
            }
        }
    }

    return ChatHistoryResult.Success(checkNotNull(accumulated))
}

/** Follows authenticated older pages, without decrypting them, until a notification target is found. */
fun MessagesRepository.loadHistoryUntilMessage(conversationId: String, messageId: String): ChatHistoryResult {
    if (!MessagesRepository.isUuid(conversationId)) return ChatHistoryResult.Failure("This conversation link is invalid.")
    if (!MessagesRepository.isUuid(messageId)) return ChatHistoryResult.Failure("This message link is invalid.")
    var cursor: String? = null
    var accumulated: ChatMessagePage? = null

    repeat(MessagesRepository.MAX_INITIAL_HISTORY_PAGES) {
        when (val loaded = loadMessages(conversationId, cursor)) {
            is ChatHistoryResult.Failure -> {
                val existing = accumulated ?: return loaded
                return ChatHistoryResult.Success(existing, continuationError = loaded.message, targetMessageFound = false)
            }
            is ChatHistoryResult.Success -> {
                val previous = accumulated
                val merged = if (previous == null) loaded.page else ChatMessagePage(
                    messages = (previous.messages + loaded.page.messages).distinctBy(EncryptedChatMessage::id),
                    nextCursor = loaded.page.nextCursor,
                )
                accumulated = merged
                if (merged.messages.any { it.id == messageId }) {
                    return ChatHistoryResult.Success(merged, targetMessageFound = true)
                }
                cursor = loaded.page.nextCursor ?: return ChatHistoryResult.Success(merged, targetMessageFound = false)
            }
        }
    }

    return ChatHistoryResult.Success(checkNotNull(accumulated), targetMessageFound = false)
}
