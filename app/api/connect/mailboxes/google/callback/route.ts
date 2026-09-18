import { mailboxCallback } from "@/src/server/mailbox-route";
export const runtime = "nodejs";
export const GET = mailboxCallback;
