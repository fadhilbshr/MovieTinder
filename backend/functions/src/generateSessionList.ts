import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { Session, SessionFilters } from './types';

const TMDB_DISCOVER_URL = 'https://api.themoviedb.org/3/discover/movie';
const MAX_TMDB_PAGES = 20; // safety cap: don't chase a listSize TMDb can't fill

interface TmdbDiscoverResponse {
  results: { id: number }[];
  total_pages: number;
}

export const generateSessionList = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in (anonymous auth) before creating a session.');
  }

  const filters = validateFilters(request.data);
  const movieIds = await fetchMovieIds(filters);

  if (movieIds.length === 0) {
    throw new HttpsError('not-found', 'No movies matched these filters. Try loosening them.');
  }

  const db = getFirestore();
  const sessionRef = db.collection('sessions').doc();

  const session: Session = {
    hostId: request.auth.uid,
    filters,
    movieIds,
    status: 'lobby',
    createdAt: Timestamp.now(),
  };

  await sessionRef.set(session);

  return { sessionId: sessionRef.id };
});

function validateFilters(data: unknown): SessionFilters {
  if (typeof data !== 'object' || data === null) {
    throw new HttpsError('invalid-argument', 'Filters payload must be an object.');
  }

  const d = data as Record<string, unknown>;
  const isNumberArray = (v: unknown): v is number[] =>
    Array.isArray(v) && v.every((x) => typeof x === 'number');

  if (
    !isNumberArray(d.genres) ||
    typeof d.yearMin !== 'number' ||
    typeof d.yearMax !== 'number' ||
    d.yearMin > d.yearMax ||
    typeof d.minRating !== 'number' ||
    d.minRating < 0 ||
    d.minRating > 10 ||
    typeof d.runtimeMin !== 'number' ||
    typeof d.runtimeMax !== 'number' ||
    d.runtimeMin > d.runtimeMax ||
    !isNumberArray(d.streamingServices) ||
    typeof d.region !== 'string' ||
    d.region.length === 0 ||
    typeof d.listSize !== 'number' ||
    d.listSize < 10 ||
    d.listSize > 100
  ) {
    throw new HttpsError('invalid-argument', 'Filters failed validation.');
  }

  return {
    genres: d.genres,
    yearMin: d.yearMin,
    yearMax: d.yearMax,
    minRating: d.minRating,
    runtimeMin: d.runtimeMin,
    runtimeMax: d.runtimeMax,
    streamingServices: d.streamingServices,
    region: d.region,
    listSize: d.listSize,
  };
}

async function fetchMovieIds(filters: SessionFilters): Promise<number[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'TMDB_API_KEY is not configured.');
  }

  const movieIds: number[] = [];
  const seen = new Set<number>();
  let page = 1;
  let totalPages = MAX_TMDB_PAGES;

  while (movieIds.length < filters.listSize && page <= Math.min(totalPages, MAX_TMDB_PAGES)) {
    const response = await fetch(buildDiscoverUrl(filters, apiKey, page));
    if (!response.ok) {
      throw new HttpsError('internal', `TMDb request failed with status ${response.status}.`);
    }

    const data = (await response.json()) as TmdbDiscoverResponse;
    totalPages = data.total_pages;

    for (const movie of data.results) {
      if (seen.has(movie.id)) continue;
      seen.add(movie.id);
      movieIds.push(movie.id);
      if (movieIds.length === filters.listSize) break;
    }

    page += 1;
  }

  return movieIds;
}

function buildDiscoverUrl(filters: SessionFilters, apiKey: string, page: number): string {
  const params = new URLSearchParams({
    api_key: apiKey,
    page: String(page),
    sort_by: 'popularity.desc',
    include_adult: 'false',
    watch_region: filters.region,
    'vote_average.gte': String(filters.minRating),
    'primary_release_date.gte': `${filters.yearMin}-01-01`,
    'primary_release_date.lte': `${filters.yearMax}-12-31`,
    'with_runtime.gte': String(filters.runtimeMin),
    'with_runtime.lte': String(filters.runtimeMax),
  });

  if (filters.genres.length > 0) {
    params.set('with_genres', filters.genres.join(','));
  }

  if (filters.streamingServices.length > 0) {
    params.set('with_watch_providers', filters.streamingServices.join('|'));
    params.set('with_watch_monetization_types', 'flatrate');
  }

  return `${TMDB_DISCOVER_URL}?${params.toString()}`;
}
