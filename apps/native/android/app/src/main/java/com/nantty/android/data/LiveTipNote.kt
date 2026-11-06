package com.nantty.android.data

internal const val MAX_LIVE_TIP_NOTE_CODE_POINTS = 280

/** Trims optional donation notes and counts Unicode code points, not UTF-16 code units. */
internal fun normalizeLiveTipNote(note: String?): String? {
    val normalized = note?.trim()?.takeIf(String::isNotEmpty) ?: return null
    return normalized.takeIf { it.codePointCount(0, it.length) <= MAX_LIVE_TIP_NOTE_CODE_POINTS }
}

internal fun limitLiveTipNote(note: String): String {
    val codePoints = note.codePointCount(0, note.length)
    if (codePoints <= MAX_LIVE_TIP_NOTE_CODE_POINTS) return note
    return note.substring(0, note.offsetByCodePoints(0, MAX_LIVE_TIP_NOTE_CODE_POINTS))
}
