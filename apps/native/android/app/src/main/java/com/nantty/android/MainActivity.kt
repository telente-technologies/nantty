package com.nantty.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.nantty.android.ui.NanttyApp
import com.nantty.android.ui.theme.NanttyTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            NanttyTheme {
                NanttyApp()
            }
        }
    }
}
