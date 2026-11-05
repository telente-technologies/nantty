package com.nantty.android.data

import android.content.ContentResolver
import android.net.Uri
import com.nantty.android.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

data class ProfileImageData(val contentType: String, val bytes: ByteArray)

data class ProfileImageUploadIntent(
    val mediaId: String,
    val uploadUrl: String,
    val method: String,
    val headers: Map<String, String>,
    val maximumSizeBytes: Long,
)

sealed interface ProfileImageUploadResult {
    data class Success(val mediaId: String) : ProfileImageUploadResult
    data class Failure(val message: String) : ProfileImageUploadResult
}

fun interface ProfileImageSource {
    fun read(uri: Uri, resolver: ContentResolver): ProfileImageData
}

interface ProfileImageTransport {
    fun createIntent(path: String, accessToken: String, body: JSONObject): JSONObject
    fun upload(intent: ProfileImageUploadIntent, bytes: ByteArray)
}

class ProfileImageRepository(
    private val baseUrl: String = BuildConfig.NANTTY_API_BASE_URL,
    private val sessionProvider: () -> AccountSession? = { null },
    private val transport: ProfileImageTransport = JdkProfileImageTransport(baseUrl),
    private val imageSource: ProfileImageSource = ResolverProfileImageSource,
) {
    fun upload(uri: Uri, purpose: String, resolver: ContentResolver): ProfileImageUploadResult =
        upload(purpose, imageSource.read(uri, resolver))

    internal fun upload(purpose: String, image: ProfileImageData): ProfileImageUploadResult = try {
        require(purpose in PROFILE_IMAGE_PURPOSES) { "This profile image type is not supported." }
        val session = sessionProvider()?.takeIf { it.accessToken.isNotBlank() }
            ?: error("Sign in to update your profile photo.")
        require(image.contentType in PROFILE_IMAGE_CONTENT_TYPES) { "Choose a JPEG, PNG or WebP image." }
        require(image.bytes.isNotEmpty() && image.bytes.size <= MAX_PROFILE_IMAGE_BYTES) { "Images can be at most 5 MB." }
        val response = transport.createIntent(
            UPLOAD_INTENT_PATH,
            session.accessToken,
            JSONObject()
                .put("purpose", purpose)
                .put("contentType", image.contentType)
                .put("sizeBytes", image.bytes.size),
        )
        val payload = response.optJSONObject("data") ?: response
        val intent = ProfileImageUploadIntent(
            mediaId = payload.optString("mediaId").takeIf(String::isNotBlank) ?: error("Nantty returned an invalid image upload."),
            uploadUrl = payload.optString("uploadUrl"),
            method = payload.optString("method"),
            headers = payload.optJSONObject("headers")?.let { headers ->
                buildMap {
                    val keys = headers.keys()
                    while (keys.hasNext()) {
                        val key = keys.next()
                        put(key, headers.optString(key))
                    }
                }
            }.orEmpty(),
            maximumSizeBytes = payload.optLong("maximumSizeBytes", payload.optLong("maximumSize", MAX_PROFILE_IMAGE_BYTES.toLong())),
        )
        require(intent.method == HTTP_PUT) { "Nantty returned an unsupported image upload method." }
        require(intent.maximumSizeBytes in 1..MAX_PROFILE_IMAGE_BYTES.toLong() && image.bytes.size <= intent.maximumSizeBytes) {
            "This image is larger than the allowed upload size."
        }
        require(isSafeUploadUrl(intent.uploadUrl)) { "Nantty returned an unsafe image upload URL." }
        require(intent.headers.keys.none { it.equals("Authorization", ignoreCase = true) }) {
            "Nantty returned an invalid image upload header."
        }
        transport.upload(intent, image.bytes)
        ProfileImageUploadResult.Success(intent.mediaId)
    } catch (error: Exception) {
        ProfileImageUploadResult.Failure(error.message ?: "Couldn't upload your photo. Try again.")
    }

    companion object {
        const val UPLOAD_INTENT_PATH = "/api/v1/users/me/media/upload-intents"
        const val MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024
        const val AVATAR_PURPOSE = "avatar"
        const val BANNER_PURPOSE = "banner"
        const val HTTP_PUT = "PUT"
        private val PROFILE_IMAGE_PURPOSES = setOf(AVATAR_PURPOSE, BANNER_PURPOSE)
        private val PROFILE_IMAGE_CONTENT_TYPES = setOf("image/jpeg", "image/png", "image/webp")
    }
}

private object ResolverProfileImageSource : ProfileImageSource {
    override fun read(uri: Uri, resolver: ContentResolver): ProfileImageData {
        val contentType = resolver.getType(uri)?.lowercase()?.takeIf(String::isNotBlank)
            ?: error("Couldn't read that image. Choose another photo.")
        val input = resolver.openInputStream(uri) ?: error("Couldn't read that image. Choose another photo.")
        val output = ByteArrayOutputStream()
        input.use { stream ->
            val buffer = ByteArray(8_192)
            while (true) {
                val count = stream.read(buffer)
                if (count < 0) break
                require(output.size() + count <= ProfileImageRepository.MAX_PROFILE_IMAGE_BYTES) {
                    "Images can be at most 5 MB."
                }
                output.write(buffer, 0, count)
            }
        }
        return ProfileImageData(contentType, output.toByteArray())
    }
}

private class JdkProfileImageTransport(
    private val baseUrl: String,
    private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) : ProfileImageTransport {
    override fun createIntent(path: String, accessToken: String, body: JSONObject): JSONObject {
        val origin = trustedApiOrigin(baseUrl) ?: error("Configure an HTTPS Nantty API URL to upload profile images.")
        val connection = openConnection(URL(origin + path)).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val response = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.use(::readBoundedResponse).orEmpty()
            if (status !in 200..299) error("Profile image request failed (HTTP $status). Try again.")
            if (response.isBlank()) error("Nantty returned an empty image upload response.")
            return JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    override fun upload(intent: ProfileImageUploadIntent, bytes: ByteArray) {
        val connection = openConnection(URL(intent.uploadUrl)).apply {
            requestMethod = intent.method
            connectTimeout = 15_000
            readTimeout = 30_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            intent.headers.forEach { (name, value) ->
                require(name.isNotBlank() && value.none { it == '\r' || it == '\n' }) { "Nantty returned an invalid image upload header." }
                setRequestProperty(name, value)
            }
        }
        try {
            connection.outputStream.use { it.write(bytes) }
            if (connection.responseCode !in 200..299) error("Couldn't upload your photo. Try again.")
        } finally {
            connection.disconnect()
        }
    }

    private fun readBoundedResponse(input: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            require(output.size() + read <= MAX_RESPONSE_BYTES) { "Nantty returned an unexpectedly large image response." }
            output.write(buffer, 0, read)
        }
        return output.toString(Charsets.UTF_8.name())
    }

    private companion object {
        const val MAX_RESPONSE_BYTES = 1_048_576
    }
}

private fun isSafeUploadUrl(value: String): Boolean = runCatching {
    val uri = URI(value)
    uri.isAbsolute && uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank() && uri.userInfo == null
}.getOrDefault(false)
