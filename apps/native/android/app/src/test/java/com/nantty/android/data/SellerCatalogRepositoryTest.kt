package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SellerCatalogRepositoryTest {
    @Test
    fun loadUsesAuthenticatedSellerProductsContractAndFiltersArchivedRows() {
        var captured: Triple<String, String, String>? = null
        val repository = repository { method, path, token, _, _ ->
            captured = Triple(method, path, token)
            SellerCatalogResponse(200, """{"data":[
                {"id":"p-1","name":"Linen shirt","description":"Linen","status":"active","publishedOnline":true,"images":[{"mediaId":"m-1","url":"https://cdn.nantty.com/p-1.jpg"}],"options":[],"variants":[
                    {"id":"v-1","optionValues":{},"sku":"sku-1","price":{"amountMinor":100,"currency":"NGN"},"stock":[]},
                    {"id":"v-2","optionValues":{},"sku":"sku-2","price":{"amountMinor":100,"currency":"NGN"},"stock":[]}
                ],"tags":[]},
                {"id":"p-2","name":"Draft","status":"draft","publishedOnline":false,"images":[],"variants":[]},
                {"id":"p-3","name":"Archived","status":"archived","publishedOnline":false},
                {"id":"bad/id","name":"Invalid","status":"active"}
            ],"nextCursor":"next"}""")
        }

        val result = repository.load() as SellerCatalogResult.Success

        assertEquals(Triple("GET", SellerCatalogRepository.PRODUCTS_PATH, "seller-token"), captured)
        assertEquals(listOf("p-1", "p-2"), result.value.map(SellerCatalogProduct::id))
        assertEquals("https://cdn.nantty.com/p-1.jpg", result.value.first().imageUrl)
        assertEquals(2, result.value.first().variantCount)
        assertNull(result.value.last().imageUrl)
    }

    @Test
    fun publicationUsesPostContractAndRequiresServerConfirmation() {
        var captured: Triple<String, String, String>? = null
        val repository = repository { method, path, token, _, _ ->
            captured = Triple(method, path, token)
            SellerCatalogResponse(200, """{"data":{"id":"p-1","publishedOnline":true}}""")
        }

        val result = repository.setPublished("p-1", publish = true)

        assertEquals(Triple("POST", "/api/v1/seller/products/p-1/publish", "seller-token"), captured)
        assertTrue(result is SellerCatalogResult.Success)
    }

    @Test
    fun publicationRejectsUnconfirmedServerState() {
        val repository = repository { _, _, _, _, _ ->
            SellerCatalogResponse(200, """{"data":{"id":"p-1","publishedOnline":false}}""")
        }

        val result = repository.setPublished("p-1", publish = true)

        assertTrue(result is SellerCatalogResult.Failure)
    }

    @Test
    fun invalidProductIdsNeverReachTransport() {
        var called = false
        val repository = repository { _, _, _, _, _ ->
            called = true
            error("Unexpected network request")
        }

        val result = repository.setPublished("../p-1", publish = true)

        assertFalse(called)
        assertTrue(result is SellerCatalogResult.Failure)
    }

    @Test
    fun authorizationFailureRequestsSignIn() {
        val repository = repository { _, _, _, _, _ -> SellerCatalogResponse(403, "{}") }

        val result = repository.load() as SellerCatalogResult.Failure

        assertTrue(result.authenticationRequired)
    }

    @Test
    fun createUsesSellerContractWithSafeDefaultsAndIdempotencyKey() {
        var request: Triple<String, String, JSONObject?>? = null
        var key: String? = null
        val repository = repository { method, path, _, body, idempotencyKey ->
            request = Triple(method, path, body)
            key = idempotencyKey
            SellerCatalogResponse(201, productResponse("created-1", "Linen shirt"))
        }

        val result = repository.save(
            SellerCatalogUpsert(
                form = SellerCatalogForm(" Linen shirt ", "Soft linen.", "2500.00", "4", emptyList()),
                product = null,
                images = listOf(SellerCatalogImage("media-1", "https://cdn.nantty.com/p-1.jpg")),
                brand = null,
                defaultLocationId = "loc-1",
                skuSeed = "seller-create-key-1234",
            ),
        )

        assertTrue(result is SellerCatalogResult.Success)
        assertEquals("POST", request?.first)
        assertEquals(SellerCatalogRepository.PRODUCTS_COLLECTION_PATH, request?.second)
        assertEquals("seller-create-key-1234", key)
        assertEquals("Linen shirt", request?.third?.optString("name"))
        assertEquals(250_000L, request?.third?.getJSONArray("variants")?.getJSONObject(0)?.getLong("priceMinor"))
        assertEquals("active", request?.third?.optString("status"))
        assertEquals("media-1", request?.third?.getJSONArray("imageMediaIds")?.getString(0))
        assertEquals("loc-1", request?.third?.getJSONArray("variants")?.getJSONObject(0)?.getJSONArray("openingStock")?.getJSONObject(0)?.getString("locationId"))
    }

    @Test
    fun createRejectsInvalidPriceBeforeNetworkRequest() {
        var called = false
        val repository = repository { _, _, _, _, _ ->
            called = true
            error("Unexpected network request")
        }

        val result = repository.save(
            SellerCatalogUpsert(SellerCatalogForm("Linen shirt", "", "0", "0", emptyList()), null, emptyList(), null, null, "seller-create-key-1234"),
        )

        assertFalse(called)
        assertTrue(result is SellerCatalogResult.Failure)
    }

    @Test
    fun editUsesPatchAndPreservesMatchedVariantAndBrandRelationship() {
        var request: Triple<String, String, JSONObject?>? = null
        val repository = repository { method, path, _, body, _ ->
            request = Triple(method, path, body)
            SellerCatalogResponse(200, productResponse("product-1", "Updated shirt"))
        }
        val existing = parseSellerCatalogProduct(JSONObject(existingProductResponse()))
        val form = sellerCatalogForm(existing).copy(name = "Updated shirt", priceMajorText = "90.00")
        val result = repository.save(
            SellerCatalogUpsert(form, existing, existing.images, existing.brand, null, "seller-update-key-1234"),
        )

        assertTrue(result is SellerCatalogResult.Success)
        assertEquals("PATCH", request?.first)
        assertEquals("/api/v1/seller/products/product-1", request?.second)
        assertEquals("variant-small", request?.third?.getJSONArray("variants")?.getJSONObject(0)?.getString("id"))
        assertEquals("authorised_reseller", request?.third?.getJSONObject("brand")?.getString("relationship"))
        assertEquals("media-1", request?.third?.getJSONArray("imageMediaIds")?.getString(0))

        repository.save(SellerCatalogUpsert(form, existing, emptyList(), existing.brand, null, "seller-update-key-1234"))
        assertEquals(0, request?.third?.getJSONArray("imageMediaIds")?.length())
    }

    @Test
    fun locationAndBrandSearchUseExistingPublicSellerContracts() {
        val requests = mutableListOf<Pair<String, String>>()
        val repository = repository { method, path, _, _, _ ->
            requests += method to path
            when {
                path == SellerCatalogRepository.LOCATIONS_PATH -> SellerCatalogResponse(200, """{"data":[{"id":"loc-1","name":"Lagos","active":true,"isDefault":true}]}""")
                else -> SellerCatalogResponse(200, """{"data":[{"id":"brand-1","name":"Nantty Label","handle":"nantty-label"}]}""")
            }
        }

        val locations = repository.loadLocations() as SellerCatalogResult.Success
        val brands = repository.searchBrands("Nantty Label") as SellerCatalogResult.Success

        assertEquals("loc-1", locations.value.single().id)
        assertEquals("brand-1", brands.value.single().id)
        assertEquals("GET" to "/api/v1/seller/locations", requests.first())
        assertEquals("GET" to "/api/v1/brands?q=Nantty+Label", requests.last())
    }

    @Test
    fun archiveUsesDeleteAndChecksCanonicalResponse() {
        var request: Pair<String, String>? = null
        val repository = repository { method, path, _, _, _ ->
            request = method to path
            SellerCatalogResponse(200, """{"data":{"id":"product-1","name":"Archived","status":"archived","publishedOnline":false,"variants":[],"images":[]}}""")
        }

        val result = repository.archive("product-1")

        assertTrue(result is SellerCatalogResult.Success)
        assertEquals("DELETE" to "/api/v1/seller/products/product-1", request)
    }

    @Test
    fun optionsRespectBackendLimitsAndBlockRemovalOfInStockVariant() {
        val form = SellerCatalogForm("Linen shirt", "", "25.00", "0", listOf(SellerCatalogOptionDraft("Size", "Small, Medium")))
        val tooManyOptions = listOf("Size", "Colour", "Material").map { name -> SellerCatalogOptionDraft(name, (1..30).joinToString(", ") { "$name$it" }) }
        val invalid = SellerCatalogUpsert(form.copy(options = tooManyOptions), null, emptyList(), null, null, "seller-create-key-1234")
        assertTrue(validateSellerCatalogForm(invalid)?.contains("100 variants") == true)

        val existing = parseSellerCatalogProduct(JSONObject(existingProductResponse()))
        val removal = SellerCatalogUpsert(
            sellerCatalogForm(existing).copy(options = listOf(SellerCatalogOptionDraft("Size", "Small", "Size"))),
            existing, existing.images, existing.brand, null, "seller-update-key-1234",
        )
        assertTrue(validateSellerCatalogForm(removal)?.contains("Set stock to 0") == true)

        val removeAllOptions = SellerCatalogUpsert(
            sellerCatalogForm(existing).copy(options = emptyList()),
            existing, existing.images, existing.brand, null, "seller-update-key-1234",
        )
        assertTrue(validateSellerCatalogForm(removeAllOptions)?.contains("Set stock to 0") == true)
    }

    private fun repository(transport: SellerCatalogTransport) = SellerCatalogRepository(
        sessionProvider = {
            AccountSession("seller-token", "refresh", AccountUser("seller", "Seller", "seller", null, null, emptyList()))
        },
        transport = transport,
    )

    private fun productResponse(id: String, name: String) = """{"data":{"id":"$id","name":"$name","description":"","status":"active","publishedOnline":true,"images":[],"options":[],"variants":[{"id":"variant-1","optionValues":{},"sku":"NT-SKU-1","price":{"amountMinor":250000,"currency":"NGN"},"stock":[]}],"taxable":true,"trackInventory":true,"tags":[]}}"""

    private fun existingProductResponse() = """{"data":{"id":"product-1","name":"Linen shirt","description":"Soft linen.","categoryId":"category-1","status":"active","publishedOnline":true,"images":[{"mediaId":"media-1","url":"https://cdn.nantty.com/shirt.jpg"}],"options":[{"name":"Size","values":["Small","Medium"]}],"variants":[{"id":"variant-small","optionValues":{"Size":"Small"},"sku":"shirt-small","barcode":null,"price":{"amountMinor":8000,"currency":"NGN"},"compareAtPrice":{"amountMinor":10000,"currency":"NGN"},"costPrice":{"amountMinor":4000,"currency":"NGN"},"lowStockThreshold":5,"stock":[{"locationId":"location-1","onHand":2,"reserved":0}]},{"id":"variant-medium","optionValues":{"Size":"Medium"},"sku":"shirt-medium","barcode":null,"price":{"amountMinor":8500,"currency":"NGN"},"compareAtPrice":null,"costPrice":null,"lowStockThreshold":5,"stock":[{"locationId":"location-1","onHand":1,"reserved":0}]}],"taxable":true,"trackInventory":true,"tags":["linen"],"brand":{"brandId":"brand-1","name":"Nantty Label","relationship":"authorised_reseller"}}}"""
}
