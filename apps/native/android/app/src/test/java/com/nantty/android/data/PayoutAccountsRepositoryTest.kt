package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PayoutAccountsRepositoryTest {
    @Test
    fun listsOnlyServerReturnedPayoutAccounts() {
        val transport = RecordingPayoutTransport { method, path, token, _, _ ->
            assertEquals("GET", method)
            assertEquals(PayoutAccountsRepository.PAYOUT_ACCOUNTS_PATH, path)
            assertEquals("access-token", token)
            JSONObject("""{"data":[{"id":"account-1","bankCode":"058","bankName":"Bank from API","accountNumberMasked":"••••4821","accountName":"A. User","countryCode":"NG","isDefault":true}]}""")
        }

        val result = PayoutAccountsRepository("https://api.nantty.com", ::session, transport = transport).list() as PayoutAccountsResult.Success

        assertEquals("Bank from API", result.accounts.single().bankName)
        assertEquals("••••4821", result.accounts.single().accountNumberMasked)
        assertTrue(result.accounts.single().isDefault)
    }

    @Test
    fun loadsBankCatalogFromAuthenticatedCountryEndpoint() {
        val transport = RecordingPayoutTransport { method, path, token, _, _ ->
            assertEquals("GET", method)
            assertEquals("/api/v1/banks?country=NG", path)
            assertEquals("access-token", token)
            JSONObject("""{"data":[{"code":"API-01","name":"API Bank","countryCode":"NG"}]}""")
        }

        val result = PayoutAccountsRepository("https://api.nantty.com", ::session, transport = transport).listBanks("ng") as PayoutBanksResult.Success

        assertEquals(listOf(PayoutBank("API-01", "API Bank", "NG")), result.banks)
    }

    @Test
    fun addSendsSingleUseStepUpHeaderWithoutInventingIdempotencyContract() {
        val transport = RecordingPayoutTransport { method, path, token, body, headers ->
            assertEquals("POST", method)
            assertEquals(PayoutAccountsRepository.PAYOUT_ACCOUNTS_PATH, path)
            assertEquals("access-token", token)
            assertEquals("058", body?.optString("bankCode"))
            assertEquals("0123456789", body?.optString("accountNumber"))
            assertEquals(setOf("bankCode", "accountNumber"), body?.names()?.let { names ->
                buildSet { for (index in 0 until names.length()) add(names.getString(index)) }
            })
            assertEquals(mapOf("X-Step-Up-Token" to "grant-once"), headers)
            JSONObject("""{"data":{"id":"account-2"}}""")
        }

        val result = PayoutAccountsRepository("https://api.nantty.com", ::session, transport = transport)
            .add("058", "0123456789", "grant-once")

        assertEquals(PayoutMutationResult.Success, result)
        assertEquals(1, transport.calls.size)
    }

    @Test
    fun deleteUsesEncodedAccountIdAndFreshStepUpHeader() {
        val transport = RecordingPayoutTransport { method, path, _, body, headers ->
            assertEquals("DELETE", method)
            assertEquals("${PayoutAccountsRepository.PAYOUT_ACCOUNTS_PATH}/123e4567-e89b-12d3-a456-426614174000", path)
            assertEquals(null, body)
            assertEquals(mapOf("X-Step-Up-Token" to "fresh-grant"), headers)
            JSONObject()
        }

        val result = PayoutAccountsRepository("https://api.nantty.com", ::session, transport = transport)
            .remove("123e4567-e89b-12d3-a456-426614174000", "fresh-grant")

        assertEquals(PayoutMutationResult.Success, result)
    }

    @Test
    fun stepUpSupportsPasswordAndEmailOtpWithoutPersistingOrReusingGrant() {
        val methods = mutableListOf<String>()
        val transport = RecordingPayoutTransport { method, path, token, body, _ ->
            methods += "$method $path"
            when (path) {
                PayoutAccountsRepository.STEP_UP_PATH -> {
                    assertEquals("access-token", token)
                    if (body?.has("password") == true) JSONObject("""{"data":{"stepUpToken":"password-grant","expiresIn":300}}""")
                    else {
                        assertEquals("verified-otp", body?.optString("otpToken"))
                        JSONObject("""{"data":{"stepUpToken":"email-grant","expiresIn":300}}""")
                    }
                }
                PayoutAccountsRepository.OTP_SEND_PATH -> {
                    assertEquals(null, token)
                    JSONObject("""{"data":{"expiresIn":300}}""")
                }
                PayoutAccountsRepository.OTP_VERIFY_PATH -> {
                    assertEquals(null, token)
                    JSONObject("""{"data":{"otpToken":"verified-otp"}}""")
                }
                else -> error("Unexpected route $path")
            }
        }
        val repository = PayoutAccountsRepository("https://api.nantty.com", ::session, transport = transport)

        val passwordGrant = repository.grantWithPassword("secret")
        assertEquals("password-grant", passwordGrant.getOrThrow().token)
        assertEquals(Unit, repository.sendEmailCode("person@example.com").getOrThrow())
        val emailGrant = repository.grantWithEmailCode("person@example.com", "123456")
        assertEquals("email-grant", emailGrant.getOrThrow().token)
        assertEquals(
            listOf(
                "POST ${PayoutAccountsRepository.STEP_UP_PATH}",
                "POST ${PayoutAccountsRepository.OTP_SEND_PATH}",
                "POST ${PayoutAccountsRepository.OTP_VERIFY_PATH}",
                "POST ${PayoutAccountsRepository.STEP_UP_PATH}",
            ),
            methods,
        )
    }

    @Test
    fun invalidAccountNumbersAreRejectedBeforeNetworkMutation() {
        val transport = RecordingPayoutTransport { _, _, _, _, _ -> error("Invalid account must not reach API") }

        val result = PayoutAccountsRepository("https://api.nantty.com", ::session, transport = transport)
            .add("058", "123", "grant-once")

        assertTrue(result is PayoutMutationResult.Failure)
        assertFalse(transport.calls.isNotEmpty())
    }

    private fun session() = AccountSession(
        "access-token", "refresh-token", AccountUser("user-1", "Ari", "ari", "person@example.com", null, emptyList()),
    )

    private class RecordingPayoutTransport(
        private val response: (String, String, String?, JSONObject?, Map<String, String>) -> JSONObject,
    ) : PayoutAccountsTransport {
        data class Call(val method: String, val path: String, val token: String?, val body: JSONObject?, val headers: Map<String, String>)
        val calls = mutableListOf<Call>()

        override fun request(method: String, path: String, accessToken: String?, body: JSONObject?, headers: Map<String, String>): JSONObject {
            calls += Call(method, path, accessToken, body, headers)
            return response(method, path, accessToken, body, headers)
        }
    }
}
