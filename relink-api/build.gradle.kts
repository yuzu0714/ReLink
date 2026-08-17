
plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(ktorLibs.plugins.ktor)
    alias(libs.plugins.kotlin.serialization)
}

group = "com"
version = "1.0.0-SNAPSHOT"

application {
    mainClass = "io.ktor.server.netty.EngineMain"
}

kotlin {
    jvmToolchain(21)
}

dependencies {
    implementation(ktorLibs.serialization.kotlinx.json)
    implementation(ktorLibs.server.auth)
    implementation(ktorLibs.server.auth.jwt)
    implementation(ktorLibs.server.callId)
    implementation(ktorLibs.server.callLogging)
    implementation(ktorLibs.server.config.yaml)
    implementation(ktorLibs.server.contentNegotiation)
    implementation(ktorLibs.server.core)
    implementation(ktorLibs.server.cors)
    implementation(ktorLibs.server.netty)
    implementation(ktorLibs.server.statusPages)
    implementation(libs.logback.classic)

    testImplementation(kotlin("test"))
    testImplementation(ktorLibs.server.testHost)
     // ↓↓↓ 追加:画像アップロードでSupabase Storage APIを叩くためのHTTPクライアント ↓↓↓
    implementation(ktorLibs.client.core)
    implementation(ktorLibs.client.cio)
    //追加分
    implementation("org.jetbrains.exposed:exposed-core:0.55.0")
    implementation("org.jetbrains.exposed:exposed-dao:0.55.0")
    implementation("org.jetbrains.exposed:exposed-jdbc:0.55.0")
    implementation("org.postgresql:postgresql:42.7.4")
    implementation("io.github.cdimascio:dotenv-kotlin:6.4.1")
}

tasks.test {
    //先に開発を進めるためにこの部分でfailOnNoDiscoveredTestsを無効にしているよ
    useJUnitPlatform()
    failOnNoDiscoveredTests = false   // ← この1行を追加
}
