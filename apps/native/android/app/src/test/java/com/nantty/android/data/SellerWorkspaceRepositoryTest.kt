package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SellerWorkspaceRepositoryTest {
    @Test
    fun loadsServerAccessThenApplicationAndStoreScopedDashboard() {
        val requests = mutableListOf<Triple<String, String, Map<String, String>>>()
        val repository = SellerWorkspaceRepository(
            sessionProvider = ::sellerSession,
            transport = SellerWorkspaceTransport { path, token, headers ->
                requests += Triple(path, token, headers)
                when {
                    path == "/api/v1/seller/access" -> """{"storeId":"11111111-1111-4111-8111-111111111111","storeName":"Server Store","role":"owner","permissions":["dashboard:view"]}"""
                    path == "/api/v1/seller/applications/me" -> """{"id":"22222222-2222-4222-8222-222222222222","status":"approved","storeName":"Server Store","categoryName":"Clothing","submittedAt":"2026-10-01T12:00:00Z","rejectionReason":null}"""
                    path == "/api/v1/seller/dashboard?period=week" -> """{"period":"week","totalSales":{"amountMinor":123450,"currency":"NGN"},"orders":7,"catalog":{"totalProducts":9,"activeProducts":6,"draftProducts":3},"recentOrders":[{"id":"33333333-3333-4333-8333-333333333333","orderNumber":"N-001","customerName":"Ada","itemsCount":2,"status":"paid","total":{"amountMinor":9000,"currency":"NGN"},"createdAt":"2026-10-02T12:00:00Z"}]}"""
                    else -> error("Unexpected request: $path")
                }
            },
        )

        val result = repository.load(SellerDashboardPeriod.WEEK) as SellerWorkspaceResult.Success

        assertEquals("11111111-1111-4111-8111-111111111111", result.workspace.access.storeId)
        assertEquals("owner", result.workspace.access.role)
        assertEquals("approved", result.workspace.application?.status)
        assertEquals(123450L, result.workspace.dashboard?.totalSalesMinor)
        assertEquals("NGN", result.workspace.dashboard?.currency)
        assertEquals(7, result.workspace.dashboard?.orders)
        assertEquals("N-001", result.workspace.dashboard?.recentOrders?.single()?.orderNumber)
        assertEquals(
            listOf(
                "/api/v1/seller/access",
                "/api/v1/seller/applications/me",
                "/api/v1/seller/dashboard?period=week",
            ),
            requests.map { it.first },
        )
        assertTrue(requests.all { it.second == "seller-token" })
        assertEquals(mapOf("X-Seller-Store" to "11111111-1111-4111-8111-111111111111"), requests.last().third)
        assertTrue(requests.dropLast(1).all { it.third.isEmpty() })
    }

    @Test
    fun doesNotRequestDashboardWithoutServerGrantedStore() {
        val paths = mutableListOf<String>()
        val repository = SellerWorkspaceRepository(
            sessionProvider = ::sellerSession,
            transport = SellerWorkspaceTransport { path, _, _ ->
                paths += path
                if (path == "/api/v1/seller/access") """{"storeId":null,"storeName":null,"role":null,"permissions":[]}"""
                else "null"
            },
        )

        val result = repository.load() as SellerWorkspaceResult.Success

        assertNull(result.workspace.access.storeId)
        assertNull(result.workspace.application)
        assertNull(result.workspace.dashboard)
        assertEquals(listOf("/api/v1/seller/access", "/api/v1/seller/applications/me"), paths)
    }

    @Test
    fun rejectsMissingSessionBeforeAnyRequest() {
        var requests = 0
        val repository = SellerWorkspaceRepository(
            sessionProvider = { null },
            transport = SellerWorkspaceTransport { _, _, _ -> requests++; error("must not call") },
        )

        val result = repository.load() as SellerWorkspaceResult.Failure

        assertTrue(result.authenticationRequired)
        assertEquals(0, requests)
    }

    @Test
    fun dashboardPeriodUsesOnlySupportedServerValues() {
        val repository = SellerWorkspaceRepository(sessionProvider = ::sellerSession, transport = SellerWorkspaceTransport { _, _, _ -> error("unused") })

        assertEquals("/api/v1/seller/dashboard?period=live", repository.dashboardPath(SellerDashboardPeriod.LIVE))
        assertEquals("/api/v1/seller/dashboard?period=yesterday", repository.dashboardPath(SellerDashboardPeriod.YESTERDAY))
        assertEquals("/api/v1/seller/dashboard?period=all", repository.dashboardPath(SellerDashboardPeriod.ALL))
        assertFalse(SellerDashboardPeriod.entries.any { it.apiValue == "quarter" })
    }

    @Test
    fun rejectsMalformedServerStoreAndDashboardCurrency() {
        val repository = SellerWorkspaceRepository(sessionProvider = ::sellerSession, transport = SellerWorkspaceTransport { _, _, _ -> "{}" })

        assertTrue(runCatching { repository.parseAccess("""{"storeId":"not-a-uuid"}""") }.isFailure)
        assertTrue(runCatching {
            repository.parseDashboard("""{"totalSales":{"amountMinor":1,"currency":"NGN!"}}""")
        }.isFailure)
    }

    @Test
    fun loadsServerOptionsAndSubmitsApplicationWithExplicitLogisticsAndIdempotency() {
        val getPaths = mutableListOf<String>()
        val posts = mutableListOf<Triple<String, String?, JSONObject>>()
        val applicationTransport = object : SellerApplicationTransport {
            override fun get(path: String, accessToken: String): String {
                assertEquals("seller-token", accessToken)
                getPaths += path
                return when (path) {
                    "/api/v1/users/me/settings" -> """{"data":{"countryCode":"NG"}}"""
                    "/api/v1/categories" -> """{"data":{"items":[{"id":"11111111-1111-4111-8111-111111111111","name":"Fashion"}]}}"""
                    "/api/v1/banks?country=NG" -> """{"data":[{"code":"058","name":"GTBank"}]}"""
                    else -> error("Unexpected seller options route: $path")
                }
            }

            override fun post(path: String, accessToken: String, idempotencyKey: String?, body: JSONObject): String {
                assertEquals("seller-token", accessToken)
                posts += Triple(path, idempotencyKey, JSONObject(body.toString()))
                return """{"data":{"id":"22222222-2222-4222-8222-222222222222","status":"pending","storeName":"Ada Textiles","categoryName":"Fashion","submittedAt":"2026-11-05T10:00:00Z"}}"""
            }
        }
        val repository = SellerWorkspaceRepository(
            sessionProvider = ::sellerSession,
            applicationTransport = applicationTransport,
        )

        val options = repository.loadApplicationOptions() as SellerApplicationOptionsResult.Success
        assertEquals("NG", options.options.countryCode)
        assertEquals("11111111-1111-4111-8111-111111111111", options.options.categories.single().id)
        assertEquals("058", options.options.banks.single().code)
        assertEquals(listOf("/api/v1/users/me/settings", "/api/v1/categories", "/api/v1/banks?country=NG"), getPaths)

        val result = repository.submitApplication(
            SellerApplicationSubmission(
                storeName = " Ada Textiles ", categoryId = "11111111-1111-4111-8111-111111111111",
                description = "Handwoven textiles made in Lagos.", phone = "+234 801 234 5678",
                addressLine = "12 Allen Avenue", city = "Ikeja", state = "Lagos", enableLogistics = false,
                documentType = "nin_slip", documentNumber = "12345678901", documentPhotoUrl = "https://media.nantty.com/kyc/document.jpg",
                bankCode = "058", accountNumber = "0123456789",
            ),
            idempotencyKey = "seller-application-key-001",
        )

        assertTrue(result is SellerApplicationMutationResult.Success)
        assertEquals("pending", (result as SellerApplicationMutationResult.Success).application.status)
        assertEquals(1, posts.size)
        assertEquals("/api/v1/seller/applications", posts.single().first)
        assertEquals("seller-application-key-001", posts.single().second)
        val body = posts.single().third
        assertEquals("Ada Textiles", body.getString("storeName"))
        assertEquals("+2348012345678", body.getString("phone"))
        assertEquals(false, body.getBoolean("enableLogistics"))
        assertEquals("nin_slip", body.getJSONObject("identityDocument").getString("documentType"))
        assertEquals("0123456789", body.getJSONObject("payoutAccount").getString("accountNumber"))
    }

    private fun sellerSession() = AccountSession(
        accessToken = "seller-token",
        refreshToken = "seller-refresh",
        user = AccountUser("user-1", "Seller", "seller", null, null, listOf("seller")),
    )
}
