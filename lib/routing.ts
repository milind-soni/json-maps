/**
 * Pluggable routing providers.
 *
 * A RoutingProvider is a function that takes start/end points and returns
 * an array of coordinates following real roads. Ship with pre-built
 * providers for common services; consumers can write their own.
 */

export interface RoutingRequest {
  from: [number, number];
  to: [number, number];
  waypoints?: [number, number][];
  profile?: string;
}

/**
 * A routing provider resolves start/end points into road-following coordinates.
 * Return a Promise of [lng, lat][] pairs.
 */
export type RoutingProvider = (req: RoutingRequest) => Promise<[number, number][]>;

/* ---- Helper: build coordinate string for OSRM-style APIs ---- */

function buildCoordString(req: RoutingRequest): string {
  const points = [req.from, ...(req.waypoints ?? []), req.to];
  return points.map((p) => `${p[0]},${p[1]}`).join(";");
}

function extractRouteCoords(data: Record<string, unknown>): [number, number][] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = (data as any).routes;
  if (!routes?.[0]?.geometry?.coordinates) {
    throw new Error("No route found in response");
  }
  return routes[0].geometry.coordinates;
}

/* ---- OSRM ---- */

const DEFAULT_OSRM_URL = "https://router.project-osrm.org";

/**
 * OSRM routing provider.
 * Profiles: "driving", "walking", "cycling"
 *
 * @param baseUrl - OSRM server URL (default: public demo server)
 */
export function osrmProvider(baseUrl = DEFAULT_OSRM_URL): RoutingProvider {
  return async (req) => {
    const profile = req.profile ?? "driving";
    const coords = buildCoordString(req);
    const url = `${baseUrl}/route/v1/${profile}/${coords}?geometries=geojson&overview=full`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM returned ${res.status}`);
    const data = await res.json();
    return extractRouteCoords(data);
  };
}

/* ---- Mapbox ---- */

/**
 * Mapbox Directions API provider.
 * Profiles: "driving", "walking", "cycling", "driving-traffic"
 *
 * @param accessToken - Mapbox access token (required)
 * @param baseUrl - API base URL (default: https://api.mapbox.com)
 */
export function mapboxProvider(
  accessToken: string,
  baseUrl = "https://api.mapbox.com",
): RoutingProvider {
  return async (req) => {
    const profile = req.profile ?? "driving";
    const coords = buildCoordString(req);
    const url = `${baseUrl}/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&access_token=${accessToken}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Mapbox returned ${res.status}`);
    const data = await res.json();
    return extractRouteCoords(data);
  };
}
