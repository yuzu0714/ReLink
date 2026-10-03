package com

import io.ktor.server.application.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.http.*

fun Application.configureHTTP() {
    install(CORS) {
        allowHost("127.0.0.1:5500")
        allowHost("localhost:5500")
        // ローカルネットワーク（スマホ確認用）
        // allowHost("192.168.0.165:5500")
        // allowHost("192.168.1.165:5500")
        // allowHost("172.20.117.3:5500")
        // 開発中は anyHost() でもOK（本番では外すこと）
        anyHost()
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Patch)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Authorization)
    }
}
