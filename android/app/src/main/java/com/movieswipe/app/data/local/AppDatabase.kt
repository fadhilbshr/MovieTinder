package com.movieswipe.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

// Movie cache entities land here in Phase 3, once the TMDb movie detail
// shape driving the swipe deck is settled.
@Database(entities = [], version = 1)
abstract class AppDatabase : RoomDatabase()
