package com.nantty.android.security.chatcrypto

import java.time.Instant
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder

internal data class ResolvedDevice(
    val userId: String,
    val deviceId: String,
    val identityKey: String,
)

/** Kotlin counterpart of `packages/chatCrypto/src/recipients.ts`. */
internal class RecipientResolver(
    private val store: ProtocolStore,
    private val directory: ChatDeviceKeyDirectory,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private data class CachedDeviceList(val fetchedAt: Long, val devices: List<ChatDirectoryDevice>)

    private val cache = mutableMapOf<String, CachedDeviceList>()

    @Synchronized
    fun resolve(userIds: List<String>, fresh: Boolean = false): List<ResolvedDevice> {
        val requestedUsers = userIds.distinct()
        val currentTime = now()
        val staleUsers = requestedUsers.filter { userId ->
            val cached = cache[userId]
            fresh || cached == null || cached.fetchedAt + DEVICE_LIST_TTL_MILLIS < currentTime
        }
        if (staleUsers.isNotEmpty()) {
            val listedUsers = directory.listDevices(staleUsers)
            staleUsers.forEach { userId ->
                // Ignore unrequested/duplicate user rows exactly as the RN lookup does.
                val devices = listedUsers.firstOrNull { it.userId == userId }?.devices.orEmpty()
                applyTrust(userId, devices)
                cache[userId] = CachedDeviceList(currentTime, devices)
            }
        }
        return requestedUsers.flatMap { userId ->
            cache[userId]?.devices.orEmpty().map { device ->
                ResolvedDevice(userId, device.deviceId, device.identityKey)
            }
        }
    }

    @Synchronized
    fun forget(userId: String) {
        cache.remove(userId)
    }

    @Synchronized
    fun ensureSessions(cipher: SessionCipher, devices: List<ResolvedDevice>): List<ResolvedDevice> {
        val missing = devices.filterNot { cipher.hasSession(it.userId, it.deviceId) }
        if (missing.isNotEmpty()) {
            val bundles = directory.claimPreKeyBundles(missing.map { ChatDeviceAddress(it.userId, it.deviceId) })
            bundles.forEach { bundle ->
                val expected = missing.firstOrNull { it.userId == bundle.userId && it.deviceId == bundle.deviceId }
                    ?: return@forEach
                if (expected.identityKey != bundle.identityKey) return@forEach
                try {
                    cipher.initiateFromBundle(bundle)
                } catch (_: Exception) {
                    // A malformed/expired peer bundle must not prevent other devices from resolving.
                }
            }
        }
        return devices.filter { cipher.hasSession(it.userId, it.deviceId) }
    }

    private fun applyTrust(userId: String, listed: List<ChatDirectoryDevice>) {
        val prior = store.loadTrust(userId)
        val currentDevices = listed.associate { it.deviceId to it.identityKey }

        // RN creates the first record without a changedAt timestamp or session invalidation.
        if (prior == null) {
            store.saveTrust(
                userId,
                mapOf(TRUST_DEVICES_KEY to currentDevices, TRUST_CHANGED_AT_KEY to null, TRUST_ACKNOWLEDGED_AT_KEY to null),
            )
            return
        }

        val priorDevices = prior[TRUST_DEVICES_KEY].asStringMap()
        val replacedDeviceIds = listed
            .filter { device -> priorDevices[device.deviceId]?.let { it != device.identityKey } == true }
            .map { it.deviceId }
        val addedDeviceIds = listed.filter { it.deviceId !in priorDevices }.map { it.deviceId }
        val removedDeviceIds = priorDevices.keys.filter { it !in currentDevices }

        (replacedDeviceIds + removedDeviceIds).forEach { deviceId -> store.deleteSession(userId, deviceId) }
        val changed = replacedDeviceIds.isNotEmpty() || addedDeviceIds.isNotEmpty()
        val changedAt = if (changed) ISO_INSTANT_MILLIS.format(Instant.ofEpochMilli(now())) else prior[TRUST_CHANGED_AT_KEY] as? String
        store.saveTrust(
            userId,
            mapOf(
                TRUST_DEVICES_KEY to currentDevices,
                TRUST_CHANGED_AT_KEY to changedAt,
                TRUST_ACKNOWLEDGED_AT_KEY to (prior[TRUST_ACKNOWLEDGED_AT_KEY] as? String),
            ),
        )
    }

    private fun Any?.asStringMap(): Map<String, String> {
        val values = this as? Map<*, *> ?: error("Stored chat identity trust record is malformed.")
        return values.entries.associate { (key, value) ->
            require(key is String && value is String) { "Stored chat identity trust record is malformed." }
            key to value
        }
    }

    private companion object {
        const val DEVICE_LIST_TTL_MILLIS = 30_000L
        const val TRUST_DEVICES_KEY = "devices"
        const val TRUST_CHANGED_AT_KEY = "changedAt"
        const val TRUST_ACKNOWLEDGED_AT_KEY = "acknowledgedAt"
        val ISO_INSTANT_MILLIS: DateTimeFormatter = DateTimeFormatterBuilder().appendInstant(3).toFormatter()
    }
}
