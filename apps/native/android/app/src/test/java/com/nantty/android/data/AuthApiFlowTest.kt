package com.nantty.android.data

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.nio.charset.StandardCharsets
import java.util.concurrent.CopyOnWriteArrayList
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthApiFlowTest {
    @Test
    fun authFlowCallsExistingContractsAndParsesReplies() {
        val requests = CopyOnWriteArrayList<Pair<String, JSONObject?>>()
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { exchange ->
            val body = exchange.requestBody.use { input -> input.readBytes().toString(StandardCharsets.UTF_8) }
            val json = body.takeIf(String::isNotBlank)?.let(::JSONObject)
            requests += exchange.requestMethod + " " + exchange.requestURI.toString() to json
            val (status, response) = when (exchange.requestURI.path) {
                "/api/v1/auth/otp/send" -> 200 to """{"data":{"expiresIn":300}}"""
                "/api/v1/auth/otp/verify" -> 200 to """{"data":{"otpToken":"verified-token"}}"""
                "/api/v1/auth/username-suggestion" -> 200 to """{"data":{"username":"ari_1"}}"""
                "/api/v1/auth/username-available" -> 200 to """{"data":{"available":false,"reason":"taken","message":"Choose another.","suggestions":["ari_2"]}}"""
                "/api/v1/auth/register" -> 201 to """{"data":{"accessToken":"access","refreshToken":"refresh","user":{"id":"u1","name":"Ari","username":"ari","roles":["user"]}}}"""
                "/api/v1/topics" -> 200 to """{"data":[{"id":"topic-1","name":"Art"}]}"""
                "/api/v1/users/me/topics" -> 204 to ""
                "/api/v1/auth/password/reset" -> 204 to ""
                "/api/v1/auth/google" -> if (json?.optString("birthday").isNullOrBlank()) {
                    422 to """{"code":"BIRTHDAY_REQUIRED","message":"Add your birthday to finish creating your account."}"""
                } else {
                    201 to """{"data":{"accessToken":"social-access","refreshToken":"social-refresh","user":{"id":"u2","name":"Ada","username":"ada","roles":["user"]}}}"""
                }
                else -> 404 to "{}"
            }
            exchange.responseHeaders.add("Content-Type", "application/json")
            if (status == 204) exchange.sendResponseHeaders(status, -1)
            else {
                val bytes = response.toByteArray(StandardCharsets.UTF_8)
                exchange.sendResponseHeaders(status, bytes.size.toLong())
                exchange.responseBody.use { it.write(bytes) }
            }
        }
        server.start()

        try {
            val api = AuthApi("http://127.0.0.1:${server.address.port}")
            assertEquals(300, api.sendOtp("ari@example.com", "signup"))
            assertEquals("verified-token", api.verifyOtp("ari@example.com", "123456", "signup"))
            assertEquals("ari_1", api.usernameSuggestion("ari@example.com"))
            val availability = api.usernameAvailability("ari name")
            assertFalse(availability.available)
            assertEquals("taken", availability.reason)
            assertEquals(listOf("ari_2"), availability.suggestions)
            val created = api.register("ari@example.com", "2000-01-02", "Ari#1234", "ari", "verified-token")
            assertEquals("u1", created.user.id)
            assertEquals(listOf(AuthTopic("topic-1", "Art")), api.topics("access"))
            api.saveTopics("access", listOf("topic-1", "topic-1"))
            api.resetPassword("verified-token", "New#12345")

            val birthdayRequired = runCatching { api.signInWithGoogle("valid-google-id-token-value", "0123456789abcdef0123456789abcdef") }.exceptionOrNull()
            assertEquals("BIRTHDAY_REQUIRED", (birthdayRequired as AuthApiException).code)
            assertEquals("valid-google-id-token-value", requests[8].second?.optString("idToken"))
            assertEquals("0123456789abcdef0123456789abcdef", requests[8].second?.optString("nonce"))
            assertFalse(requests[8].second?.has("birthday") == true)
            val social = api.signInWithGoogle("valid-google-id-token-value", "0123456789abcdef0123456789abcdef", "2000-01-02")
            assertEquals("u2", social.user.id)
            assertEquals("2000-01-02", requests[9].second?.optString("birthday"))

            assertEquals(listOf(
                "POST /api/v1/auth/otp/send",
                "POST /api/v1/auth/otp/verify",
                "GET /api/v1/auth/username-suggestion?seed=ari%40example.com",
                "GET /api/v1/auth/username-available?username=ari+name",
                "POST /api/v1/auth/register",
                "GET /api/v1/topics",
                "PUT /api/v1/users/me/topics",
                "POST /api/v1/auth/password/reset",
                "POST /api/v1/auth/google",
                "POST /api/v1/auth/google",
            ), requests.map { it.first })
            assertEquals("ari@example.com", requests[0].second?.optString("destination"))
            assertEquals("signup", requests[0].second?.optString("purpose"))
            assertEquals("signup", requests[1].second?.optString("purpose"))
            assertEquals("verified-token", requests[7].second?.optString("otpToken"))
            assertNotNull("Expected JSON body for topic save: ${requests[6]}", requests[6].second)
            assertEquals(listOf("topic-1"), requests[6].second?.getJSONArray("topicIds")?.let { ids -> (0 until ids.length()).map(ids::getString) })
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun otpValidationRejectsNonDigitsBeforeSending() {
        val api = AuthApi("http://127.0.0.1:1")
        assertTrue(runCatching { api.verifyOtp("ari@example.com", "١٢٣٤٥٦", "signup") }.exceptionOrNull() is IllegalArgumentException)
        assertTrue(runCatching { api.sendOtp("ari@example.com", "unknown") }.exceptionOrNull() is IllegalArgumentException)
    }
}
