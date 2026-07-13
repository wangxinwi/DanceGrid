import { readJson, removeJson, sha256Base64, writeJson } from "@/lib/storage";

export type BetaEntitlement = {
  token: string;
  issuedAt: number;
  updatedAt: number;
  expiresAt?: number;
  seatId?: string;
  inviteCodeHash?: string;
  deviceId?: string;
  source: "worker" | "dev";
};

const betaEntitlementKey = "dancegrid-beta-entitlement";
const betaSessionKey = "dancegrid-beta-session";
const betaDeviceKey = "dancegrid-device-id";

function getInviteWorkerUrl() {
  return (import.meta.env.VITE_DANCEGRID_INVITE_WORKER_URL as string | undefined)?.trim() ?? "";
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return "device-dev";
  }
  const existing = window.localStorage.getItem(betaDeviceKey);
  if (existing) return existing;
  const next = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(betaDeviceKey, next);
  return next;
}

function isValidEntitlement(entitlement: BetaEntitlement | null) {
  if (!entitlement) return false;
  if (typeof entitlement.expiresAt === "number" && entitlement.expiresAt <= Date.now()) return false;
  return Boolean(entitlement.token);
}

async function createDevEntitlement(inviteCode: string): Promise<BetaEntitlement> {
  const normalized = inviteCode.trim().toUpperCase();
  if (normalized !== "LOCAL-100") {
    throw new Error("邀请码无效。");
  }
  const now = Date.now();
  return {
    token: `dev-${now}`,
    issuedAt: now,
    updatedAt: now,
    seatId: "dev-seat-100",
    inviteCodeHash: await sha256Base64(normalized),
    deviceId: getOrCreateDeviceId(),
    source: "dev",
  };
}

export async function readStoredBetaEntitlement(): Promise<BetaEntitlement | null> {
  const entitlement = await readJson<BetaEntitlement>(betaEntitlementKey);
  return isValidEntitlement(entitlement) ? entitlement : null;
}

export async function saveBetaEntitlement(entitlement: BetaEntitlement): Promise<void> {
  await writeJson(betaEntitlementKey, entitlement);
  sessionStorage.setItem(betaSessionKey, "1");
}

export async function clearBetaEntitlement(): Promise<void> {
  await removeJson(betaEntitlementKey);
  sessionStorage.removeItem(betaSessionKey);
}

export function hasActiveBetaSession() {
  return sessionStorage.getItem(betaSessionKey) === "1";
}

export async function validateBetaInviteCode(inviteCode: string): Promise<BetaEntitlement> {
  const normalized = inviteCode.trim();
  if (!normalized) {
    throw new Error("请输入邀请码。");
  }

  const workerUrl = getInviteWorkerUrl();
  if (!workerUrl) {
    if (import.meta.env.DEV) {
      return createDevEntitlement(normalized);
    }
    throw new Error("邀请码服务未配置。");
  }

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app: "dancegrid",
      inviteCode: normalized,
      deviceId: getOrCreateDeviceId(),
      platform: "web",
    }),
  });

  if (!response.ok) {
    throw new Error("邀请码校验失败，请稍后重试。");
  }

  const payload = (await response.json()) as Partial<BetaEntitlement> & {
    ok?: boolean;
    message?: string;
  };

  if (!payload.ok) {
    throw new Error(payload.message || "邀请码无效或席位已满。");
  }

  const now = Date.now();
  const inviteCodeHash = await sha256Base64(normalized.toUpperCase());
  return {
    token: payload.token ?? `worker-${now}`,
    issuedAt: payload.issuedAt ?? now,
    updatedAt: now,
    expiresAt: payload.expiresAt,
    seatId: payload.seatId,
    inviteCodeHash,
    deviceId: payload.deviceId ?? getOrCreateDeviceId(),
    source: "worker",
  };
}
