plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

val apiBaseUrl = providers.gradleProperty("nanttyApiBaseUrl")
    .orElse(providers.environmentVariable("NANTTY_API_BASE_URL"))
    .getOrElse("")
val webAppBaseUrl = providers.gradleProperty("nanttyWebAppUrl")
    .orElse(providers.environmentVariable("NANTTY_WEBAPP_URL"))
    .getOrElse("https://web.nantty.com")
val googleServerClientId = providers.gradleProperty("nanttyGoogleServerClientId")
    .orElse(providers.environmentVariable("NANTTY_GOOGLE_SERVER_CLIENT_ID"))
    .getOrElse("")
val firebaseAppId = providers.gradleProperty("nanttyFirebaseAppId")
    .orElse(providers.environmentVariable("NANTTY_FIREBASE_APP_ID"))
    .getOrElse("")
val firebaseApiKey = providers.gradleProperty("nanttyFirebaseApiKey")
    .orElse(providers.environmentVariable("NANTTY_FIREBASE_API_KEY"))
    .getOrElse("")
val firebaseProjectId = providers.gradleProperty("nanttyFirebaseProjectId")
    .orElse(providers.environmentVariable("NANTTY_FIREBASE_PROJECT_ID"))
    .getOrElse("")
val firebaseSenderId = providers.gradleProperty("nanttyFirebaseSenderId")
    .orElse(providers.environmentVariable("NANTTY_FIREBASE_SENDER_ID"))
    .getOrElse("")

fun String.asBuildConfigString(): String = "\"${replace("\\", "\\\\").replace("\"", "\\\"")}\""

android {
    namespace = "com.nantty.android"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.nantty.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "NANTTY_API_BASE_URL", apiBaseUrl.asBuildConfigString())
        buildConfigField("String", "NANTTY_WEBAPP_URL", webAppBaseUrl.trimEnd('/').asBuildConfigString())
        buildConfigField("String", "NANTTY_GOOGLE_SERVER_CLIENT_ID", googleServerClientId.asBuildConfigString())
        buildConfigField("String", "NANTTY_FIREBASE_APP_ID", firebaseAppId.asBuildConfigString())
        buildConfigField("String", "NANTTY_FIREBASE_API_KEY", firebaseApiKey.asBuildConfigString())
        buildConfigField("String", "NANTTY_FIREBASE_PROJECT_ID", firebaseProjectId.asBuildConfigString())
        buildConfigField("String", "NANTTY_FIREBASE_SENDER_ID", firebaseSenderId.asBuildConfigString())
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.core)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    implementation(libs.coil.compose)
    implementation(libs.androidx.compose.adaptive)
    implementation(libs.androidx.glance)
    implementation(libs.androidx.glance.material3)
    implementation(libs.androidx.work.runtime)
    implementation(libs.bouncycastle.prov)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.googleid)
    implementation(libs.androidx.biometric)
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.ui)
    implementation(libs.livekit.android)
    implementation(libs.livekit.compose.components)
    debugImplementation(libs.androidx.compose.ui.tooling)
    testImplementation(libs.junit)
    testImplementation(libs.json.test)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}

tasks.withType<org.gradle.api.tasks.testing.Test>().configureEach {
    systemProperty(
        "nanttySignalV1SerializationFixture",
        rootProject.file("../../../packages/chatCrypto/fixtures/signal-v1-serialization.json").absolutePath,
    )
    systemProperty(
        "nanttySenderKeysFixture",
        rootProject.file("../../../packages/chatCrypto/fixtures/sender-keys-v1.json").absolutePath,
    )
    systemProperty(
        "nanttyX3dhFixture",
        rootProject.file("../../../packages/chatCrypto/fixtures/x3dh-v1.json").absolutePath,
    )
}
