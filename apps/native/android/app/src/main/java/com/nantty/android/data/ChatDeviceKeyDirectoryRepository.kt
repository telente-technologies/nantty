package com.nantty.android.data

import com.nantty.android.BuildConfig
import com.nantty.android.security.chatcrypto.ChatDeviceAddress
import com.nantty.android.security.chatcrypto.ChatDeviceKeyDirectory
import com.nantty.android.security.chatcrypto.ChatDeviceKeyStatus
import com.nantty.android.security.chatcrypto.ChatDirectoryDevice
import com.nantty.android.security.chatcrypto.ChatPreKeyBundle
import com.nantty.android.security.chatcrypto.ChatDeviceRegistrationRequest
import com.nantty.android.security.chatcrypto.ChatUserDeviceList
import com.nantty.android.security.chatcrypto.ChatWireOneTimePreKey
import com.nantty.android.security.chatcrypto.ChatWireSignedPreKey
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection

/** Authenticated adapter for the same Social-owned key-directory contract used by React Native. */
internal class ChatDeviceKeyDirectoryRepository(
    private val sessionProvider: () -> AccountSession?,
    private val refreshSessionProvider: () -> AccountSession? = { null },
    private val transport: ChatThreadTransport = JdkChatThreadTransport(BuildConfig.NANTTY_API_BASE_URL),
) : ChatDeviceKeyDirectory {
    override fun registerDevice(deviceId: String, request: ChatDeviceRegistrationRequest): ChatDeviceKeyStatus =
        status(request("PUT", devicePath(deviceId), request.toJson()), deviceId)

    override fun fetchDeviceStatus(deviceId: String): ChatDeviceKeyStatus? = try {
        status(request("GET", devicePath(deviceId)), deviceId)
    } catch (error: MessagesHttpException) {
        if (error.statusCode == HttpURLConnection.HTTP_NOT_FOUND) null else throw error
    }

    override fun uploadOneTimePreKeys(deviceId: String, keys: List<ChatWireOneTimePreKey>): ChatDeviceKeyStatus {
        require(keys.size in 1..MAXIMUM_ONE_TIME_PREKEY_UPLOAD) { "Secure-chat prekey batch size is invalid." }
        return status(
            request("POST", "${devicePath(deviceId)}/prekeys", JSONObject().put("oneTimePreKeys", keys.toJson())),
            deviceId,
        )
    }

    override fun rotateSignedPreKey(deviceId: String, key: ChatWireSignedPreKey): ChatDeviceKeyStatus =
        status(request("PUT", "${devicePath(deviceId)}/signed-prekey", JSONObject().put("signedPreKey", key.toJson())), deviceId)

    override fun listDevices(userIds: List<String>): List<ChatUserDeviceList> {
        require(userIds.isNotEmpty() && userIds.size <= MAXIMUM_DEVICE_QUERY && userIds.all(::isValidAccountId)) {
            "Secure-chat account lookup is invalid."
        }
        val rows = request("POST", DEVICE_QUERY_PATH, JSONObject().put("userIds", JSONArray(userIds.distinct())))
            .dataArray("device lookup")
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: error("Nantty returned an invalid secure-chat device list.")
                val userId = row.optString("userId")
                require(isValidAccountId(userId) && userId in userIds) { "Nantty returned an unexpected secure-chat account." }
                val deviceRows = row.optJSONArray("devices") ?: error("Nantty returned an incomplete secure-chat device list.")
                val devices = buildList {
                    for (deviceIndex in 0 until deviceRows.length()) {
                        val device = deviceRows.optJSONObject(deviceIndex) ?: error("Nantty returned an invalid secure-chat device.")
                        val deviceId = device.optString("deviceId")
                        val registrationId = device.exactInt("registrationId")
                        val identityKey = device.optString("identityKey")
                        require(isValidChatDeviceId(deviceId) && registrationId > 0 && identityKey.isNotBlank()) {
                            "Nantty returned an incomplete secure-chat device."
                        }
                        add(ChatDirectoryDevice(deviceId, registrationId, identityKey))
                    }
                }
                add(ChatUserDeviceList(userId, devices))
            }
        }
    }

    override fun claimPreKeyBundles(devices: List<ChatDeviceAddress>): List<ChatPreKeyBundle> {
        require(devices.isNotEmpty() && devices.size <= MAXIMUM_DEVICE_QUERY && devices.all {
            isValidAccountId(it.userId) && isValidChatDeviceId(it.deviceId)
        }) { "Secure-chat prekey lookup is invalid." }
        val uniqueDevices = devices.distinctBy { "${it.userId}:${it.deviceId}" }
        val body = JSONObject().put("devices", JSONArray().apply {
            uniqueDevices.forEach { address -> put(JSONObject().put("userId", address.userId).put("deviceId", address.deviceId)) }
        })
        val rows = request("POST", BUNDLE_CLAIM_PATH, body).dataArray("prekey bundle")
        val requested = uniqueDevices.mapTo(mutableSetOf()) { "${it.userId}:${it.deviceId}" }
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: error("Nantty returned an invalid secure-chat prekey bundle.")
                val userId = row.optString("userId")
                val deviceId = row.optString("deviceId")
                require(isValidAccountId(userId) && isValidChatDeviceId(deviceId) && "$userId:$deviceId" in requested) {
                    "Nantty returned an unexpected secure-chat prekey bundle."
                }
                val signed = row.optJSONObject("signedPreKey") ?: error("Nantty returned an incomplete signed prekey.")
                val identityKey = row.optString("identityKey")
                val registrationId = row.exactInt("registrationId")
                val signedPreKey = ChatWireSignedPreKey(
                    keyId = signed.exactInt("keyId"),
                    publicKey = signed.optString("publicKey"),
                    signature = signed.optString("signature"),
                )
                val oneTimeValue = row.opt("oneTimePreKey")
                val oneTimePreKey = when (oneTimeValue) {
                    null, JSONObject.NULL -> null
                    is JSONObject -> oneTimeValue.toOneTimePreKey()
                    else -> error("Nantty returned an invalid one-time prekey.")
                }
                require(identityKey.isNotBlank() && registrationId > 0 && signedPreKey.keyId > 0 &&
                    signedPreKey.publicKey.isNotBlank() && signedPreKey.signature.isNotBlank()) {
                    "Nantty returned an incomplete secure-chat prekey bundle."
                }
                add(ChatPreKeyBundle(userId, deviceId, registrationId, identityKey, signedPreKey, oneTimePreKey))
            }
        }
    }

    override fun removeDevice(deviceId: String) {
        request("DELETE", devicePath(deviceId))
    }

    private fun request(method: String, path: String, body: JSONObject? = null): JSONObject {
        val currentToken = sessionProvider()?.accessToken?.takeIf(String::isNotBlank)
            ?: throw MessagesHttpException(HttpURLConnection.HTTP_UNAUTHORIZED)
        return try {
            transport.request(method, path, currentToken, body)
        } catch (error: MessagesHttpException) {
            if (error.statusCode != HttpURLConnection.HTTP_UNAUTHORIZED) throw error
            val refreshedToken = refreshSessionProvider()?.accessToken?.takeIf(String::isNotBlank)
                ?: throw error
            transport.request(method, path, refreshedToken, body)
        }
    }

    private fun status(payload: JSONObject, expectedDeviceId: String): ChatDeviceKeyStatus {
        val value = payload.optJSONObject("data") ?: payload
        val deviceId = value.optString("deviceId")
        val identityKey = value.optString("identityKey")
        val signedPreKeyId = value.exactInt("signedPreKeyId")
        val oneTimePreKeyCount = value.exactInt("oneTimePreKeyCount")
        require(deviceId == expectedDeviceId && isValidChatDeviceId(deviceId)) { "Nantty returned an invalid secure-chat device status." }
        require(identityKey.isNotBlank() && signedPreKeyId > 0 && oneTimePreKeyCount >= 0) {
            "Nantty returned incomplete secure-chat device status."
        }
        return ChatDeviceKeyStatus(deviceId, identityKey, signedPreKeyId, oneTimePreKeyCount)
    }

    private fun devicePath(deviceId: String): String {
        require(isValidChatDeviceId(deviceId)) { "This secure-chat device link is invalid." }
        return "/api/v1/chat/keys/devices/$deviceId"
    }

    private fun ChatDeviceRegistrationRequest.toJson() = JSONObject()
        .put("registrationId", registrationId)
        .put("identityKey", identityKey)
        .put("signedPreKey", signedPreKey.toJson())
        .put("oneTimePreKeys", oneTimePreKeys.toJson())

    private fun ChatWireSignedPreKey.toJson() = JSONObject()
        .put("keyId", keyId)
        .put("publicKey", publicKey)
        .put("signature", signature)

    private fun ChatWireOneTimePreKey.toJson() = JSONObject()
        .put("keyId", keyId)
        .put("publicKey", publicKey)

    private fun List<ChatWireOneTimePreKey>.toJson() = JSONArray().also { array -> forEach { array.put(it.toJson()) } }

    private fun JSONObject.dataArray(label: String): JSONArray = optJSONArray("data")
        ?: error("Nantty returned an invalid secure-chat $label response.")

    private fun JSONObject.toOneTimePreKey(): ChatWireOneTimePreKey {
        val keyId = exactInt("keyId")
        val publicKey = optString("publicKey")
        require(keyId > 0 && publicKey.isNotBlank()) { "Nantty returned an incomplete one-time prekey." }
        return ChatWireOneTimePreKey(keyId, publicKey)
    }

    private fun JSONObject.exactInt(name: String): Int {
        val number = opt(name) as? Number ?: error("Nantty returned an incomplete secure-chat device status.")
        val exact = number.toInt()
        require(exact.toDouble() == number.toDouble()) { "Nantty returned an invalid secure-chat device status." }
        return exact
    }

    private companion object {
        const val MAXIMUM_ONE_TIME_PREKEY_UPLOAD = 100
        const val MAXIMUM_DEVICE_QUERY = 300
        const val DEVICE_QUERY_PATH = "/api/v1/chat/keys/devices/query"
        const val BUNDLE_CLAIM_PATH = "/api/v1/chat/keys/bundles"
    }
}

private fun isValidChatDeviceId(value: String) = value.matches(Regex("^[A-Za-z0-9_-]{8,64}$"))
private fun isValidAccountId(value: String) = value.matches(Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"))
