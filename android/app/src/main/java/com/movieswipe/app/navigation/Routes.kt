package com.movieswipe.app.navigation

// Create -> Filters -> Share -> Join -> Lobby -> Swipe -> Matches -> Results
sealed class Routes(val route: String) {
    data object Create : Routes("create")
    data object Filters : Routes("filters")

    data object Share : Routes("share/{sessionId}") {
        fun build(sessionId: String) = "share/$sessionId"
    }

    data object Join : Routes("join/{sessionId}") {
        fun build(sessionId: String) = "join/$sessionId"
    }

    data object Lobby : Routes("lobby/{sessionId}") {
        fun build(sessionId: String) = "lobby/$sessionId"
    }

    data object Swipe : Routes("swipe/{sessionId}") {
        fun build(sessionId: String) = "swipe/$sessionId"
    }

    data object Matches : Routes("matches/{sessionId}") {
        fun build(sessionId: String) = "matches/$sessionId"
    }

    data object Results : Routes("results/{sessionId}") {
        fun build(sessionId: String) = "results/$sessionId"
    }
}
