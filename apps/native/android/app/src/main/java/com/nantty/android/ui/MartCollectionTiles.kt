package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.R
import com.nantty.android.data.MartHome

private data class MartCollectionTile(
    val collection: String,
    val labelResource: Int,
    val imageUrl: String?,
)

@Composable
internal fun MartCollectionTiles(
    home: MartHome,
    onOpenCollection: (collection: String, name: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val sales = MartCollectionTile("sales_of_the_day", R.string.mart_collection_sales, home.salesOfTheDayImageUrl)
    val brands = MartCollectionTile("featured_brands", R.string.mart_collection_brands, home.featuredBrandsImageUrl)
    val arrivals = MartCollectionTile("new_arrivals", R.string.mart_collection_arrivals, home.newArrivalsImageUrl)

    Row(
        modifier = modifier.fillMaxWidth().height(184.dp).padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        MartCollectionTileCard(sales, Modifier.weight(1f), onOpenCollection)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            MartCollectionTileCard(brands, Modifier.weight(1f), onOpenCollection)
            MartCollectionTileCard(arrivals, Modifier.weight(1f), onOpenCollection)
        }
    }
}

@Composable
private fun MartCollectionTileCard(
    tile: MartCollectionTile,
    modifier: Modifier,
    onOpenCollection: (collection: String, name: String) -> Unit,
) {
    val label = stringResource(tile.labelResource)
    Card(
        onClick = { onOpenCollection(tile.collection, label) },
        modifier = modifier.semantics { contentDescription = label },
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
    ) {
        Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceContainerHighest)) {
            tile.imageUrl?.let { imageUrl ->
                AsyncImage(
                    model = imageUrl,
                    contentDescription = null,
                    modifier = Modifier.matchParentSize().clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Crop,
                )
            }
            Text(
                text = label,
                modifier = Modifier.align(Alignment.TopStart).padding(10.dp),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}
