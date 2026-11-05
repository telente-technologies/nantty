package com.nantty.android.data

import android.content.Context

internal class ConnectionListPreferencesStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun read(screenKey: String): ConnectionListPreference = ConnectionListPreference(
        sort = ConnectionSort.from(preferences.getString("$screenKey.sort", null)),
        filter = ConnectionFilter.from(preferences.getString("$screenKey.filter", null)),
    )

    fun write(screenKey: String, value: ConnectionListPreference) {
        preferences.edit()
            .putString("$screenKey.sort", value.sort.value)
            .putString("$screenKey.filter", value.filter.value)
            .apply()
    }

    companion object {
        private const val PREFERENCES_NAME = "nantty.listViewPreferences"
    }
}
