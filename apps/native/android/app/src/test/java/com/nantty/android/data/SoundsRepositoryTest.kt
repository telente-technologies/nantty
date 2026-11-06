package com.nantty.android.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SoundsRepositoryTest {
    @Test
    fun trendingAndSearchUseExistingSoundApiContracts() {
        val paths = mutableListOf<String>()
        val repository = SoundsRepository(transport = SoundsTransport { path, _ ->
            paths += path
            JSONObject("""{"data":{"data":[]}}""")
        })

        assertEquals(SoundLibraryResult.Success(emptyList()), repository.list(SoundLibraryScope.TRENDING))
        assertEquals(SoundLibraryResult.Success(emptyList()), repository.list(SoundLibraryScope.SEARCH, "Afro pop"))

        assertEquals(listOf("/api/v1/sounds/trending?limit=20", "/api/v1/sounds?q=Afro+pop&limit=20"), paths)
    }

    @Test
    fun savedSoundsRequireAnAuthenticatedSession() {
        var requested = false
        val repository = SoundsRepository(transport = SoundsTransport { _, _ ->
            requested = true
            JSONObject()
        })

        val result = repository.list(SoundLibraryScope.SAVED)

        assertEquals(SoundLibraryResult.Failure("Sign in to view saved sounds.", authenticationRequired = true), result)
        assertFalse(requested)
    }

    @Test
    fun parsesSoundReuseAndOwnershipMetadataWithoutDuplicatesOrInvalidIds() {
        val repository = SoundsRepository(transport = SoundsTransport { _, _ -> JSONObject() })
        val soundId = "00000000-0000-0000-0000-000000000001"

        val sounds = repository.parseSounds(
            JSONObject(
                """{"data":{"data":[{"id":"$soundId","title":"Track","owner":{"id":"owner-1","name":"Ada","username":"ada"},"isOriginal":false,"allowReuse":true,"status":"available","usageCount":13},{"id":"$soundId","title":"Duplicate"},{"id":"bad-id","title":"Invalid"},{"id":"00000000-0000-0000-0000-000000000002","title":"Blocked","owner":{"username":"sam"},"allowReuse":false,"status":"under_copyright_review","usageCount":-1}]}}""",
            ),
        )

        assertEquals(2, sounds.size)
        assertEquals(SelectableSound(soundId, "Track", "Ada", "ada", false, true, "available", 13), sounds[0])
        assertFalse(sounds[1].allowReuse)
        assertEquals("under_copyright_review", sounds[1].status)
        assertEquals(0, sounds[1].usageCount)
    }

    @Test
    fun blankAndOverlongSearchTermsDoNotCallTheApi() {
        var requests = 0
        val repository = SoundsRepository(transport = SoundsTransport { _, _ ->
            requests += 1
            JSONObject()
        })

        assertEquals(SoundLibraryResult.Success(emptyList()), repository.list(SoundLibraryScope.SEARCH, "  "))
        assertTrue(repository.list(SoundLibraryScope.SEARCH, "x".repeat(81)) is SoundLibraryResult.Failure)
        assertEquals(0, requests)
    }
}
