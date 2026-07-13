type D1QueryResult<T> = {
  results: T[];
  success: boolean;
  meta?: unknown;
};

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<D1QueryResult<T>>;
  run: <T = unknown>() => Promise<T>;
};

type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
  batch?: (statements: D1PreparedStatement[]) => Promise<unknown>;
};

type Env = {
  DB: D1Database;
  ADMIN_TOKEN?: string;
  SEAT_LIMIT?: string;
  RELEASE_PHASE?: string;
  ENTITLEMENT_TTL_DAYS?: string;
};

type InviteRow = {
  id: string;
  app: string;
  code_hash: string;
  code_label: string;
  seat_id: string;
  status: "active" | "redeemed" | "revoked" | "expired";
  max_redemptions: number;
  redemption_count: number;
  issued_at: number;
  expires_at: number | null;
  redeemed_at: number | null;
  redeemed_device_id: string | null;
  revoked_at: number | null;
  note: string | null;
};

type SeatRow = {
  id: string;
  seat_number: number;
  status: "available" | "reserved" | "redeemed" | "revoked" | "released";
  device_id: string | null;
  invite_code_hash: string | null;
  invite_code_label: string | null;
  note: string | null;
  last_seen_at: number | null;
  created_at: number;
  updated_at: number;
  revoked_at: number | null;
  released_at: number | null;
};

type RedeemBody = {
  app?: string;
  inviteCode?: string;
  deviceId?: string;
  platform?: string;
};

type InviteResponse = {
  ok: true;
  phase: string;
  token: string;
  seatId: string;
  deviceId: string;
  issuedAt: number;
  expiresAt?: number;
  app: string;
};

type ErrorResponse = {
  ok: false;
  code: string;
  message: string;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-admin-token",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-max-age": "86400",
};

function json(data: InviteResponse | ErrorResponse | Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function normalizeInviteCode(value: string | undefined | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeApp(value: string | undefined | null) {
  return String(value ?? "dancegrid").trim().toLowerCase() || "dancegrid";
}

function seatLimit(env: Env) {
  const parsed = Number(env.SEAT_LIMIT ?? "100");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 100;
}

function releasePhase(env: Env) {
  return (env.RELEASE_PHASE ?? "beta").trim() || "beta";
}

function ttlDays(env: Env) {
  const parsed = Number(env.ENTITLEMENT_TTL_DAYS ?? "0");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function generateSeatId(seatNumber: number) {
  return `seat-${String(seatNumber).padStart(3, "0")}`;
}

function generateCodeLabel(seatNumber: number) {
  return `DG-${String(seatNumber).padStart(3, "0")}`;
}

function generateInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = () => {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  };
  return `DG-${pick()}-${pick()}`;
}

function getNow() {
  return Date.now();
}

async function sha256Base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const array = Array.from(new Uint8Array(digest));
  return btoa(String.fromCharCode(...array));
}

async function tokenFor(seatId: string, deviceId: string, inviteCodeHash: string) {
  const now = getNow();
  return sha256Base64(`${seatId}:${deviceId}:${inviteCodeHash}:${now}:${crypto.randomUUID()}`);
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

async function firstRow<T>(db: D1Database, query: string, values: unknown[] = []) {
  const result = await db.prepare(query).bind(...values).all<T>();
  return (result.results[0] ?? null) as T | null;
}

async function allRows<T>(db: D1Database, query: string, values: unknown[] = []) {
  const result = await db.prepare(query).bind(...values).all<T>();
  return result.results as T[];
}

function isAdminRequest(request: Request, env: Env) {
  if (!env.ADMIN_TOKEN) return false;
  return request.headers.get("x-admin-token") === env.ADMIN_TOKEN;
}

async function allocateSeat(db: D1Database, env: Env, requestedSeatId?: string | null) {
  const now = getNow();
  if (requestedSeatId) {
    const seat = await firstRow<SeatRow>(db, "SELECT * FROM seats WHERE id = ? LIMIT 1", [requestedSeatId]);
    if (seat) return seat;
  }

  const reusableSeat = await firstRow<SeatRow>(
    db,
    "SELECT * FROM seats WHERE status = 'released' ORDER BY seat_number ASC LIMIT 1",
  );
  if (reusableSeat) return reusableSeat;

  const seatCountRow = await firstRow<{ count: number }>(
    db,
    "SELECT COUNT(*) AS count FROM seats WHERE status IN ('reserved', 'redeemed', 'available')",
  );
  const currentCount = Number(seatCountRow?.count ?? 0);
  if (currentCount >= seatLimit(env)) {
    throw new Error("seat-limit-reached");
  }

  const seatNumber = currentCount + 1;
  const seat: SeatRow = {
    id: generateSeatId(seatNumber),
    seat_number: seatNumber,
    status: "available",
    device_id: null,
    invite_code_hash: null,
    invite_code_label: null,
    note: null,
    last_seen_at: null,
    created_at: now,
    updated_at: now,
    revoked_at: null,
    released_at: null,
  };

  await db.prepare(
    `INSERT INTO seats
      (id, seat_number, status, device_id, invite_code_hash, invite_code_label, note, last_seen_at, created_at, updated_at, revoked_at, released_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    seat.id,
    seat.seat_number,
    seat.status,
    seat.device_id,
    seat.invite_code_hash,
    seat.invite_code_label,
    seat.note,
    seat.last_seen_at,
    seat.created_at,
    seat.updated_at,
    seat.revoked_at,
    seat.released_at,
  ).run();

  return seat;
}

async function createInvite(db: D1Database, env: Env, options: { app: string; inviteCode?: string; seatId?: string; expiresAt?: number | null; note?: string | null; count?: number | null; }) {
  const batchCount = Math.max(1, Math.min(20, Number(options.count ?? 1) || 1));
  if (batchCount > 1 && options.seatId) {
    throw new Error("batch-invite-does-not-support-explicit-seat");
  }
  const created: Array<{ inviteCode: string; seatId: string; label: string; expiresAt?: number }> = [];
  const now = getNow();

  for (let index = 0; index < batchCount; index += 1) {
    const seat = await allocateSeat(db, env, options.seatId ?? null);
    const inviteCode = normalizeInviteCode(options.inviteCode ?? generateInviteCode());
    const codeHash = await sha256Base64(inviteCode);
    const label = generateCodeLabel(seat.seat_number);
    await db.prepare(
      `UPDATE seats
         SET status = 'reserved',
             invite_code_hash = ?,
             invite_code_label = ?,
             note = COALESCE(?, note),
             updated_at = ?
       WHERE id = ?`,
    ).bind(codeHash, label, options.note ?? null, now, seat.id).run();

    await db.prepare(
      `INSERT INTO invite_codes
        (id, app, code_hash, code_label, seat_id, status, max_redemptions, redemption_count, issued_at, expires_at, redeemed_at, redeemed_device_id, revoked_at, note)
       VALUES (?, ?, ?, ?, ?, 'active', 1, 0, ?, ?, NULL, NULL, NULL, ?)`,
    ).bind(
      crypto.randomUUID(),
      options.app,
      codeHash,
      label,
      seat.id,
      now,
      options.expiresAt ?? null,
      options.note ?? null,
    ).run();

    created.push({
      inviteCode,
      seatId: seat.id,
      label,
      ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
    });
  }

  return created;
}

async function redeemInvite(db: D1Database, env: Env, body: RedeemBody) {
  const app = normalizeApp(body.app);
  const inviteCode = normalizeInviteCode(body.inviteCode);
  const deviceId = String(body.deviceId ?? "").trim();

  if (!inviteCode) {
    return json({ ok: false, code: "missing_code", message: "missing invite code" }, 400);
  }

  if (!deviceId) {
    return json({ ok: false, code: "missing_device", message: "missing device id" }, 400);
  }

  const codeHash = await sha256Base64(inviteCode);
  const invite = await firstRow<InviteRow>(
    db,
    "SELECT * FROM invite_codes WHERE app = ? AND code_hash = ? LIMIT 1",
    [app, codeHash],
  );

  if (!invite) {
    return json({ ok: false, code: "invalid_code", message: "invite code not found" }, 404);
  }

  if (invite.status === "revoked") {
    return json({ ok: false, code: "revoked", message: "invite code has been revoked" }, 403);
  }

  if (invite.expires_at && invite.expires_at <= getNow()) {
    await db.prepare("UPDATE invite_codes SET status = 'expired' WHERE id = ?").bind(invite.id).run();
    return json({ ok: false, code: "expired", message: "invite code has expired" }, 403);
  }

  const seat = await firstRow<SeatRow>(db, "SELECT * FROM seats WHERE id = ? LIMIT 1", [invite.seat_id]);
  if (!seat) {
    return json({ ok: false, code: "seat_missing", message: "seat was not found" }, 500);
  }

  if (seat.device_id && seat.device_id !== deviceId && seat.status === "redeemed") {
    return json({ ok: false, code: "device_mismatch", message: "seat is already bound to another device" }, 403);
  }

  const issuedAt = getNow();
  const expiresInDays = ttlDays(env);
  const expiresAt = expiresInDays ? issuedAt + expiresInDays * 24 * 60 * 60 * 1000 : undefined;
  const token = await tokenFor(seat.id, deviceId, codeHash);

  await db.prepare(
    `UPDATE invite_codes
        SET status = 'redeemed',
            redemption_count = redemption_count + 1,
            redeemed_at = ?,
            redeemed_device_id = ?
      WHERE id = ?`,
  ).bind(issuedAt, deviceId, invite.id).run();

  await db.prepare(
    `UPDATE seats
        SET status = 'redeemed',
            device_id = ?,
            invite_code_hash = ?,
            invite_code_label = ?,
            last_seen_at = ?,
            updated_at = ?
      WHERE id = ?`,
  ).bind(deviceId, codeHash, invite.code_label, issuedAt, issuedAt, seat.id).run();

  const response: InviteResponse = {
    ok: true,
    phase: releasePhase(env),
    token,
    seatId: seat.id,
    deviceId,
    issuedAt,
    ...(expiresAt ? { expiresAt } : {}),
    app,
  };
  return json(response);
}

async function listSeats(db: D1Database) {
  const seats = await allRows<SeatRow>(db, "SELECT * FROM seats ORDER BY seat_number ASC");
  return json({ ok: true, seats });
}

async function revokeSeat(db: D1Database, seatId: string, status: "revoked" | "released") {
  const now = getNow();
  const seat = await firstRow<SeatRow>(db, "SELECT * FROM seats WHERE id = ? LIMIT 1", [seatId]);
  if (!seat) {
    return json({ ok: false, code: "seat_missing", message: "seat was not found" }, 404);
  }

  await db.prepare(
    `UPDATE seats
        SET status = ?,
            revoked_at = CASE WHEN ? = 'revoked' THEN ? ELSE revoked_at END,
            released_at = CASE WHEN ? = 'released' THEN ? ELSE released_at END,
            updated_at = ?
      WHERE id = ?`,
  ).bind(status, status, now, status, now, now, seatId).run();

  await db.prepare(
    `UPDATE invite_codes
        SET status = CASE WHEN ? = 'released' THEN 'revoked' ELSE status END,
            revoked_at = CASE WHEN ? IN ('revoked', 'released') THEN ? ELSE revoked_at END
      WHERE seat_id = ?`,
  ).bind(status, status, now, seatId).run();

  return json({ ok: true, seatId, status, updatedAt: now });
}

async function requireAdmin(request: Request, env: Env) {
  if (!env.ADMIN_TOKEN) {
    return json({ ok: false, code: "admin_disabled", message: "admin token is not configured" }, 403);
  }
  if (!isAdminRequest(request, env)) {
    return json({ ok: false, code: "forbidden", message: "invalid admin token" }, 403);
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: JSON_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === "/health") {
      return json({ ok: true, phase: releasePhase(env), seatLimit: seatLimit(env) });
    }

    if ((path === "/" || path === "/redeem") && request.method === "POST") {
      const body = (await readJsonBody<RedeemBody>(request)) ?? {};
      return redeemInvite(env.DB, env, body);
    }

    if (path === "/admin/invites" && request.method === "POST") {
      const adminError = await requireAdmin(request, env);
      if (adminError) return adminError;
      const body = (await readJsonBody<{ app?: string; inviteCode?: string; seatId?: string; expiresAt?: number; note?: string; count?: number }>(request)) ?? {};
      const created = await createInvite(env.DB, env, {
        app: normalizeApp(body.app),
        inviteCode: body.inviteCode,
        seatId: body.seatId,
        expiresAt: body.expiresAt ?? null,
        note: body.note ?? null,
        count: body.count ?? 1,
      });
      return json({ ok: true, created });
    }

    if (path === "/admin/seats" && request.method === "GET") {
      const adminError = await requireAdmin(request, env);
      if (adminError) return adminError;
      return listSeats(env.DB);
    }

    if (path.startsWith("/admin/seats/") && request.method === "POST") {
      const adminError = await requireAdmin(request, env);
      if (adminError) return adminError;
      const [, , , seatId, action] = path.split("/");
      if (!seatId || !action) {
        return json({ ok: false, code: "bad_request", message: "missing seat id or action" }, 400);
      }
      if (action === "revoke") {
        return revokeSeat(env.DB, seatId, "revoked");
      }
      if (action === "release") {
        return revokeSeat(env.DB, seatId, "released");
      }
      return json({ ok: false, code: "unsupported_action", message: "unsupported seat action" }, 400);
    }

    return json({ ok: false, code: "not_found", message: "route not found" }, 404);
  },
};
