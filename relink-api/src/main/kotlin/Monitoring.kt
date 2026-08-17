package com

import io.ktor.server.application.*
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.callid.*
import io.ktor.server.request.*
import org.slf4j.event.Level
import java.util.UUID

fun Application.configureMonitoring() {
    install(CallId) {
        header(io.ktor.http.HttpHeaders.XRequestId)
        generate { UUID.randomUUID().toString() }
        verify { callId -> callId.isNotEmpty() }
    }

    install(CallLogging) {
        level = Level.INFO
        callIdMdc("call-id")
        filter { call -> call.request.path().startsWith("/health").not() }
    }
}