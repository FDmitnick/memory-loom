import { ensureMemorySchema, getRuntimeEnv } from "@/db/memory-store";

export const DEFAULT_FAMILY_ID = "family-default";

export type FamilyRole = "admin" | "contributor" | "viewer";

export type FamilyViewer = {
  id: string;
  email: string;
  name: string;
  role: FamilyRole;
};

function decodeDisplayName(request: Request) {
  const value = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get(
    "oai-authenticated-user-full-name-encoding",
  );
  if (!value || encoding !== "percent-encoded-utf-8") return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function requestIdentity(request: Request) {
  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase();
  if (email) {
    return {
      email,
      name: decodeDisplayName(request) || email.split("@")[0],
    };
  }

  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return { email: "owner@local.memory", name: "当前管理员" };
  }
  return null;
}

export async function getFamilyViewer(
  request: Request,
): Promise<FamilyViewer | null> {
  await ensureMemorySchema();
  const identity = requestIdentity(request);
  if (!identity) return null;

  const { DB } = getRuntimeEnv();
  await DB.prepare(
    `INSERT OR IGNORE INTO family_spaces (id, name)
     VALUES (?, ?)`,
  )
    .bind(DEFAULT_FAMILY_ID, "我们的家庭记忆")
    .run();

  const count = await DB.prepare(
    "SELECT COUNT(*) AS total FROM family_members WHERE family_id = ?",
  )
    .bind(DEFAULT_FAMILY_ID)
    .first<{ total: number }>();

  if (!Number(count?.total)) {
    await DB.prepare(
      `INSERT INTO family_members (
        id, family_id, email, name, role, status, last_seen_at
      ) VALUES (?, ?, ?, ?, 'admin', 'active', CURRENT_TIMESTAMP)`,
    )
      .bind(
        crypto.randomUUID(),
        DEFAULT_FAMILY_ID,
        identity.email,
        identity.name,
      )
      .run();
  }

  const member = await DB.prepare(
    `SELECT id, email, name, role
     FROM family_members
     WHERE family_id = ? AND email = ?`,
  )
    .bind(DEFAULT_FAMILY_ID, identity.email)
    .first<FamilyViewer>();

  if (!member) return null;

  await DB.prepare(
    `UPDATE family_members
     SET status = 'active', last_seen_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
  )
    .bind(member.id)
    .run();

  return member;
}

export function canEdit(role: FamilyRole) {
  return role === "admin" || role === "contributor";
}
