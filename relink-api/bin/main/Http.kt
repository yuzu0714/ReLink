package com

import io.ktor.server.application.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.http.*

fun Application.configureHTTP() {
    install(CORS) {
        allowHost("127.0.0.1:5500")
        allowHost("localhost:5500")
        allowHost("172.20.10.2:5500")  // ★追加: スマホ実機検証用(テザリング環境のIP)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Authorization)
    }
}
