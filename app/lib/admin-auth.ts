import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  getChatGPTUser,
  requireChatGPTUser,
  userHeadersTrusted,
  type ChatGPTUser,
} from "../chatgpt-auth";
import { readAccessConfig, verifyAccessJwt } from "./cloudflare-access";

async function configuredAdminEmails(): Promise<Set<string>> {
  let configured = process.env.ADMIN_EMAILS ?? "";
  if (!configured) {
    const { env } = await import("cloudflare:workers");
    configured =
      typeof env.ADMIN_EMAILS === "string" ? env.ADMIN_EMAILS : "";
  }

  return new Set(
    configured
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function isAdminEmail(email: string): Promise<boolean> {
  return (await configuredAdminEmails()).has(email.trim().toLowerCase());
}

/**
 * Cloudflare Access 경로의 신원. 설정이 없거나 토큰이 없거나 검증에
 * 실패하면 null — 허용목록 검사는 호출부가 한다.
 */
async function getAccessUser(): Promise<ChatGPTUser | null> {
  const config = await readAccessConfig();
  if (!config) return null;
  const token = (await headers()).get("cf-access-jwt-assertion");
  if (!token) return null;
  const identity = await verifyAccessJwt(token, config);
  if (!identity) return null;
  return {
    displayName: identity.email,
    email: identity.email,
    fullName: null,
  };
}

export async function getAuthorizedAdmin(): Promise<ChatGPTUser | null> {
  // 두 신원 경로는 배포 환경이 결정한다: Cloudflare 는 Access JWT,
  // Sites 는 신뢰 프록시가 주입한 헤더. 어느 쪽이든 ADMIN_EMAILS
  // 허용목록을 별도로 통과해야 관리자다.
  const viaAccess = await getAccessUser();
  if (viaAccess) {
    return (await isAdminEmail(viaAccess.email)) ? viaAccess : null;
  }
  const user = await getChatGPTUser();
  if (!user || !(await isAdminEmail(user.email))) return null;
  return user;
}

export async function requireAdminUser(): Promise<ChatGPTUser> {
  const admin = await getAuthorizedAdmin();
  if (admin) return admin;
  // Sites(신뢰 프록시)에서는 로그인 플로우로 보낸다 — 기존 UX 유지.
  // 그 밖(Cloudflare 등)에서는 로그인 흐름이 없으므로 존재를 드러내지
  // 않는 404 로 끝낸다.
  if (await userHeadersTrusted()) {
    const user = await requireChatGPTUser("/admin");
    if (!(await isAdminEmail(user.email))) notFound();
    return user;
  }
  notFound();
}
