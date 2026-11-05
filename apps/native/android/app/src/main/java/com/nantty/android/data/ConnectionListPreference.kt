package com.nantty.android.data

enum class ConnectionSort(val value: String, val label: String) {
    RECENT("recent", "Default (most recent)"),
    NAME("name", "Name A–Z"),
    MUTUAL("mutual", "Most mutual"),
    ;

    companion object {
        fun from(value: String?) = entries.firstOrNull { it.value == value } ?: RECENT
    }
}

enum class ConnectionFilter(val value: String, val label: String) {
    ALL("all", "Everyone"),
    FOLLOWING("following", "People you follow"),
    FOLLOWERS("followers", "People who follow you"),
    MUTUAL("mutual", "Mutual"),
    ;

    companion object {
        fun from(value: String?) = entries.firstOrNull { it.value == value } ?: ALL
    }
}

data class ConnectionListPreference(
    val sort: ConnectionSort = ConnectionSort.RECENT,
    val filter: ConnectionFilter = ConnectionFilter.ALL,
)
