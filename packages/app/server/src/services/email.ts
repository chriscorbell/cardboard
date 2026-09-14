import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { env } from "../env.js";
import { newId } from "../ids.js";
import { getUser } from "./users.js";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function queueEmail(input: {
  toUserId: string;
  subject: string;
  heading: string;
  body: string;
  linkUrl: string;
  linkLabel: string;
}): Promise<void> {
  const html = `<!doctype html><html><body style="margin:0;background:#141311;font-family:ui-sans-serif,system-ui,sans-serif;color:#e7e2d9">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
  <p style="margin:0 0 24px;font-size:13px;letter-spacing:.04em;color:#9b9384">Cardboard</p>
  <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;line-height:1.3">${escapeHtml(input.heading)}</h1>
  <div style="white-space:pre-wrap;font-size:15px;line-height:1.55;color:#cfc8bd;border-left:2px solid #3a3731;padding-left:14px;margin:0 0 28px">${escapeHtml(input.body)}</div>
  <a href="${escapeHtml(input.linkUrl)}" style="display:inline-block;background:#d9a05b;color:#1b1710;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px">${escapeHtml(input.linkLabel)}</a>
  <p style="margin:36px 0 0;font-size:12px;color:#6f6960">This address does not receive replies. Reply on the card instead.</p>
</div></body></html>`;
  const id = newId();
  await db.insert(schema.outboundEmails).values({ id, toUserId: input.toUserId, subject: input.subject, html });
  void deliver(id).catch((err) => console.error("[email] delivery failed", err));
}

async function deliver(id: string): Promise<void> {
  const row = await db.select().from(schema.outboundEmails).where(eq(schema.outboundEmails.id, id)).get();
  if (!row) return;
  const user = await getUser(row.toUserId);
  if (!user) return;
  if (!env.resendApiKey) {
    console.log(`[email] (logged, no RESEND_API_KEY) to=${user.email} subject=${JSON.stringify(row.subject)}`);
    await db
      .update(schema.outboundEmails)
      .set({ status: "logged", sentAt: new Date().toISOString() })
      .where(eq(schema.outboundEmails.id, id));
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [user.email],
      subject: row.subject,
      html: row.html,
      reply_to: "no-reply@cardboard.xode.cc",
    }),
  });
  if (!res.ok) {
    const error = `${res.status} ${await res.text()}`;
    await db.update(schema.outboundEmails).set({ status: "failed", error }).where(eq(schema.outboundEmails.id, id));
    console.error("[email] resend rejected", error);
    return;
  }
  await db
    .update(schema.outboundEmails)
    .set({ status: "sent", sentAt: new Date().toISOString() })
    .where(eq(schema.outboundEmails.id, id));
}
