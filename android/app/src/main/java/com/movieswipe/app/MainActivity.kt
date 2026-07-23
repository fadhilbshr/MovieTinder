package com.movieswipe.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.movieswipe.app.auth.AuthUiState
import com.movieswipe.app.auth.AuthViewModel
import com.movieswipe.app.navigation.MovieSwipeNavHost
import com.movieswipe.app.ui.common.ErrorScreen
import com.movieswipe.app.ui.common.LoadingScreen
import com.movieswipe.app.ui.theme.MovieSwipeTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MovieSwipeTheme {
                MovieSwipeApp()
            }
        }
    }
}

@Composable
private fun MovieSwipeApp(authViewModel: AuthViewModel = hiltViewModel()) {
    when (val state = authViewModel.state.collectAsStateWithLifecycle().value) {
        AuthUiState.Loading -> LoadingScreen()
        is AuthUiState.Error -> ErrorScreen(message = state.message)
        AuthUiState.SignedIn -> MovieSwipeNavHost()
    }
}
