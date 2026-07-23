package com.movieswipe.app.auth

import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val firebaseAuth: FirebaseAuth
) {
    val currentUserId: String?
        get() = firebaseAuth.currentUser?.uid

    // Signs in anonymously on first launch; on later launches the existing
    // FirebaseAuth session is reused, no network round-trip needed.
    suspend fun ensureSignedIn(): String {
        firebaseAuth.currentUser?.let { return it.uid }
        val result = firebaseAuth.signInAnonymously().await()
        return result.user?.uid ?: error("Anonymous sign-in did not return a user")
    }
}
