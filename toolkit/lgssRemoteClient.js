/**
 * LGSS SCUM Server Manager — Official Public Remote API & RCON Integration SDK
 * Copyright (c) 2026 Legendary Gaming (4UR3X).
 *
 * Public client library for connecting external community websites, Discord bots,
 * or custom dashboards to an authorized LGSS Manager Remote API endpoint.
 */

export const LGSS_SDK_VERSION = "1.3.35";

export const SCUM_MAP_SECTORS = Object.freeze([
  ["D4", "C4", "B4", "A4"],
  ["D3", "C3", "B3", "A3"],
  ["D2", "C2", "B2", "A2"],
  ["D1", "C1", "B1", "A1"],
  ["D0", "C0", "B0", "A0"],
]);

/**
 * Convert SCUM Unreal Engine world X/Y coordinates into official island grid sector.
 * @param {number} worldX
 * @param {number} worldY
 * @returns {string} Sector code (e.g. "B2", "C3")
 */
export function worldCoordsToSector(worldX, worldY) {
  const minBound = -904795.0;
  const maxBound = 619205.0;
  const span = maxBound - minBound;
  const normX = Math.max(0, Math.min(0.9999, (maxBound - Number(worldX || 0)) / span));
  const normY = Math.max(0, Math.min(0.9999, (maxBound - Number(worldY || 0)) / span));
  const colIdx = Math.min(3, Math.floor(normY * 4));
  const rowIdx = Math.min(4, Math.floor(normX * 5));
  const cols = ["A", "B", "C", "D"];
  const rows = ["4", "3", "2", "1", "0"];
  return `${cols[colIdx]}${rows[rowIdx]}`;
}

/**
 * Validate explicit target requirement for SCUM Native Source RCON world-spawn commands.
 * World-spawn commands always require an explicit SteamID64 or quoted "X Y Z" coordinates.
 *
 * @param {object} options
 * @param {"item"|"vehicle"|"animal"|"zombie"} options.type
 * @param {string} options.assetCode
 * @param {number} [options.quantity=1]
 * @param {string} [options.steamId]
 * @param {{x:number, y:number, z:number}} [options.coordinates]
 * @returns {string} Formatted RCON command string
 */
export function buildSafeSpawnCommand({ type = "item", assetCode, quantity = 1, steamId, coordinates }) {
  const sanitizedCode = String(assetCode || "").replace(/[^A-Za-z0-9_.\-]/g, "");
  if (!sanitizedCode) {
    throw new Error("Asset spawn code is required.");
  }

  const verbMap = {
    item: "#SpawnItem",
    vehicle: "#SpawnVehicle",
    animal: "#SpawnAnimal",
    zombie: "#SpawnZombie",
  };
  const verb = verbMap[String(type).toLowerCase()] || "#SpawnItem";
  const safeQty = Math.max(1, Math.min(50, Math.trunc(Number(quantity) || 1)));

  if (steamId && /^\d{15,20}$/.test(String(steamId).trim())) {
    return `${verb} ${sanitizedCode} ${safeQty} Location ${String(steamId).trim()}`;
  }

  if (
    coordinates &&
    Number.isFinite(Number(coordinates.x)) &&
    Number.isFinite(Number(coordinates.y)) &&
    Number.isFinite(Number(coordinates.z))
  ) {
    const cx = Number(coordinates.x).toFixed(1);
    const cy = Number(coordinates.y).toFixed(1);
    const cz = Number(coordinates.z).toFixed(1);
    return `${verb} ${sanitizedCode} ${safeQty} Location "${cx} ${cy} ${cz}"`;
  }

  throw new Error(
    "Explicit target Location (17-digit SteamID64 or {x, y, z} coordinates) is mandatory for RCON spawn commands."
  );
}

/**
 * Compute 1-step-ahead drop coordinates from a player's live position and facing vector.
 *
 * @param {{x:number, y:number, z:number, ux?:number, uy?:number}} player
 * @param {number} [distanceCm=135]
 * @param {number} [elevationOffsetCm=25]
 * @returns {{x:number, y:number, z:number}}
 */
export function computeForwardDropPoint(player, distanceCm = 135, elevationOffsetCm = 25) {
  let ux = Number(player?.ux ?? 1.0);
  let uy = Number(player?.uy ?? 0.0);
  const mag = Math.hypot(ux, uy);
  if (mag < 0.01) {
    ux = 1.0;
    uy = 0.0;
  } else {
    ux /= mag;
    uy /= mag;
  }
  return {
    x: Number(player.x) + ux * distanceCm,
    y: Number(player.y) + uy * distanceCm,
    z: Number(player.z || 0) + elevationOffsetCm,
  };
}

/**
 * Official HTTP / JWT Client for LGSS SCUM Server Manager Remote API.
 */
export class LgssRemoteApiClient {
  /**
   * @param {object} config
   * @param {string} config.baseUrl - e.g. "http://192.168.1.50:8080"
   * @param {string} [config.token] - Optional pre-issued Bearer JWT token
   * @param {number} [config.timeoutMs=10000]
   */
  constructor({ baseUrl, token = "", timeoutMs = 10000 }) {
    if (!baseUrl) {
      throw new Error("baseUrl is required to initialize LgssRemoteApiClient.");
    }
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    this.token = token;
    this.timeoutMs = timeoutMs;
  }

  setToken(jwtToken) {
    this.token = String(jwtToken || "").trim();
  }

  async _request(path, { method = "GET", body = undefined, auth = true } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = { Accept: "application/json" };
      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
      }
      if (auth && this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { raw: text };
      }
      if (!response.ok) {
        const detail = payload?.detail || payload?.message || `HTTP ${response.status}`;
        const err = new Error(`LGSS Remote API Error (${response.status}): ${detail}`);
        err.status = response.status;
        err.payload = payload;
        throw err;
      }
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Authenticate with username & password and store the returned JWT token.
   */
  async login(username, password) {
    const data = await this._request("/api/auth", {
      method: "POST",
      body: { username, password },
      auth: false,
    });
    if (data?.access_token) {
      this.token = data.access_token;
    }
    return data;
  }

  /**
   * Check manager health and version metadata.
   */
  async getHealth() {
    return this._request("/api/health", { auth: false });
  }

  /**
   * List all configured SCUM Dedicated Server instances and runtime telemetry.
   */
  async listServers() {
    return this._request("/api/servers");
  }

  /**
   * Start, stop, or restart a managed SCUM Dedicated Server.
   * @param {string} serverId
   * @param {"start"|"stop"|"restart"} action
   */
  async controlServer(serverId, action) {
    if (!["start", "stop", "restart"].includes(action)) {
      throw new Error(`Unsupported lifecycle action: ${action}`);
    }
    return this._request(`/api/servers/${encodeURIComponent(serverId)}/${action}`, {
      method: "POST",
    });
  }

  /**
   * Query Native Source RCON diagnostic status for a server.
   */
  async getRconStatus(serverId) {
    return this._request(`/api/servers/${encodeURIComponent(serverId)}/rcon/status`);
  }

  /**
   * Fetch live online players with real-time coordinates, sector, fame, and balances.
   */
  async getLivePlayers(serverId, forceRefresh = false) {
    const qs = forceRefresh ? "?force=true" : "";
    return this._request(`/api/servers/${encodeURIComponent(serverId)}/rcon/live-players${qs}`);
  }

  /**
   * Execute a single server-side RCON command (e.g. "#SetWeather 0", "#Announce Server event starting!").
   */
  async execRconCommand(serverId, command) {
    const trimmed = String(command || "").trim();
    if (!trimmed) {
      throw new Error("RCON command string cannot be empty.");
    }
    return this._request(`/api/servers/${encodeURIComponent(serverId)}/rcon/exec`, {
      method: "POST",
      body: { command: trimmed },
    });
  }

  /**
   * Dispatch one or more items/vehicles 1 step in front of a verified online player.
   *
   * @param {string} serverId
   * @param {object} params
   * @param {string} params.steamId - Mandatory 17-digit SteamID64 of online recipient
   * @param {string} [params.playerName]
   * @param {Array<{cmd:string, count?:number, spawn_type?:"item"|"vehicle"|"animal"|"zombie"}>} params.items
   */
  async dispatchItemsToPlayer(serverId, { steamId, playerName = "", items = [] }) {
    const cleanSid = String(steamId || "").trim();
    if (!/^\d{15,20}$/.test(cleanSid)) {
      throw new Error("A valid online recipient SteamID64 is strictly required.");
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("At least one spawn item entry is required.");
    }
    return this._request(`/api/servers/${encodeURIComponent(serverId)}/rcon/spawn-to-player`, {
      method: "POST",
      body: {
        steam_id: cleanSid,
        player_name: playerName,
        items: items.map((entry) => ({
          cmd: String(entry.cmd || "").trim(),
          count: Math.max(1, Number(entry.count || 1)),
          spawn_type: entry.spawn_type || "item",
          is_vehicle: entry.spawn_type === "vehicle",
        })),
      },
    });
  }

  /**
   * Create a live polling subscription for server metrics and online player coordinates.
   */
  subscribeLivePlayers(serverId, onUpdate, intervalMs = 4000) {
    let active = true;
    let busy = false;
    const poll = async () => {
      if (!active || busy) return;
      busy = true;
      try {
        const snapshot = await this.getLivePlayers(serverId, false);
        if (active) {
          onUpdate(null, snapshot);
        }
      } catch (err) {
        if (active) {
          onUpdate(err, null);
        }
      } finally {
        busy = false;
      }
    };
    poll();
    const handle = setInterval(poll, Math.max(2000, intervalMs));
    return () => {
      active = false;
      clearInterval(handle);
    };
  }
}

/**
 * Convenience helpers for standard SCUM administration workflows over LGSS RCON.
 */
export const ScumAdminPresets = Object.freeze({
  clearSunnyWeather: () => "#SetWeather 0",
  stormWeather: () => "#SetWeather 1",
  setNoon: () => "#SetTime 12",
  setMorning: () => "#SetTime 8",
  announce: (message) => `#Announce ${String(message || "").replace(/[\r\n]+/g, " ").trim()}`,
  hudNotificationAll: (message) => `#SendNotification 2 -1 ${String(message || "").trim()}`,
  setFamePoints: (steamId, amount) => `#SetFamePoints ${Math.trunc(Number(amount) || 0)} ${String(steamId).trim()}`,
  setAccountBalance: (steamId, amount) =>
    `#SetCurrencyBalance Normal ${Math.trunc(Number(amount) || 0)} ${String(steamId).trim()}`,
  setGoldBalance: (steamId, amount) =>
    `#SetCurrencyBalance Gold ${Math.trunc(Number(amount) || 0)} ${String(steamId).trim()}`,
  kickPlayer: (steamId) => `#Kick ${String(steamId).trim()}`,
  banPlayer: (steamId) => `#Ban ${String(steamId).trim()}`,
  unbanPlayer: (steamId) => `#Unban ${String(steamId).trim()}`,
});
/* LGSS Platform Release v1.3.35 */
