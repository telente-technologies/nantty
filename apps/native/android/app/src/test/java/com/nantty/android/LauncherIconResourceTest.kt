package com.nantty.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import javax.imageio.ImageIO

class LauncherIconResourceTest {
    private val resources = File("src/main/res")

    @Test
    fun manifestUsesAdaptiveMipmapAndKeepsLegacyDrawable() {
        val manifest = File("src/main/AndroidManifest.xml").readText()

        assertTrue(manifest.contains("android:icon=\"@mipmap/ic_launcher\""))
        assertTrue(manifest.contains("android:roundIcon=\"@mipmap/ic_launcher\""))
        assertTrue(File(resources, "drawable/ic_nantty.xml").isFile)
    }

    @Test
    fun adaptiveLauncherDefinesBrandLayersAndApi33Monochrome() {
        val base = File(resources, "mipmap-anydpi-v26/ic_launcher.xml").readText()
        val themed = File(resources, "mipmap-anydpi-v33/ic_launcher.xml").readText()
        val color = File(resources, "values/ic_launcher_background.xml").readText()

        assertTrue(base.contains("@color/nantty_launcher_background"))
        assertTrue(base.contains("@drawable/ic_launcher_foreground"))
        assertTrue(!base.contains("<monochrome"))
        assertTrue(themed.contains("@drawable/ic_launcher_monochrome"))
        assertTrue(color.contains("#3A2BFF"))
    }

    @Test
    fun brandLayersAreCenteredAndFitTheAdaptiveSafeZone() {
        listOf("ic_launcher_foreground.png", "ic_launcher_monochrome.png").forEach { name ->
            val image = ImageIO.read(File(resources, "drawable-nodpi/$name"))
            assertEquals(1080, image.width)
            assertEquals(1080, image.height)

            var left = image.width
            var top = image.height
            var right = -1
            var bottom = -1
            for (y in 0 until image.height) {
                for (x in 0 until image.width) {
                    if ((image.getRGB(x, y) ushr 24) != 0) {
                        left = minOf(left, x)
                        top = minOf(top, y)
                        right = maxOf(right, x)
                        bottom = maxOf(bottom, y)
                    }
                }
            }

            assertTrue("$name has visible artwork", right >= left && bottom >= top)
            assertTrue("$name exceeds the 66% safe-zone width", right - left + 1 <= 712)
            assertTrue("$name exceeds the 66% safe-zone height", bottom - top + 1 <= 712)
            assertTrue("$name is not horizontally centered", kotlin.math.abs((left + right + 1) / 2.0 - 540) <= 1)
            assertTrue("$name is not vertically centered", kotlin.math.abs((top + bottom + 1) / 2.0 - 540) <= 1)
        }
    }
}
