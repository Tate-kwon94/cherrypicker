import { notFound } from "next/navigation";
import { getChatGPTUser, requireChatGPTUser, type ChatGPTUser } from "../chatgpt-auth";

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

export async function getAuthorizedAdmin(): Promise<ChatGPTUser | null> {
  const user = await getChatGPTUser();
  if (!user || !(await isAdminEmail(user.email))) return null;
  return user;
}

export async function requireAdminUser(): Promise<ChatGPTUser> {
  const user = await requireChatGPTUser("/admin");
  if (!(await isAdminEmail(user.email))) notFound();
  return user;
}
