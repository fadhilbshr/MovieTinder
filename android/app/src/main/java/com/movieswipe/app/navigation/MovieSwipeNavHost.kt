package com.movieswipe.app.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.movieswipe.app.ui.screens.CreateScreen
import com.movieswipe.app.ui.screens.FiltersScreen
import com.movieswipe.app.ui.screens.JoinScreen
import com.movieswipe.app.ui.screens.LobbyScreen
import com.movieswipe.app.ui.screens.MatchesScreen
import com.movieswipe.app.ui.screens.ResultsScreen
import com.movieswipe.app.ui.screens.ShareScreen
import com.movieswipe.app.ui.screens.SwipeScreen

@Composable
fun MovieSwipeNavHost(
    navController: NavHostController = rememberNavController()
) {
    NavHost(navController = navController, startDestination = Routes.Create.route) {
        composable(Routes.Create.route) { CreateScreen() }
        composable(Routes.Filters.route) { FiltersScreen() }
        composable(Routes.Share.route) { ShareScreen() }
        composable(Routes.Join.route) { JoinScreen() }
        composable(Routes.Lobby.route) { LobbyScreen() }
        composable(Routes.Swipe.route) { SwipeScreen() }
        composable(Routes.Matches.route) { MatchesScreen() }
        composable(Routes.Results.route) { ResultsScreen() }
    }
}
