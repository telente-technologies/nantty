package com.nantty.android.data

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

    private fun sellerSession() = AccountSession(
        accessToken = "seller-token",
        refreshToken = "seller-refresh",
        user = AccountUser("user-1", "Seller", "seller", null, null, listOf("seller")),
    )
}
