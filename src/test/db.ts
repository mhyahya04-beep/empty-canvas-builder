import { db } from "@/lib/db/db";

export async function resetUnifiedDb(): Promise<void> {
  db.close();
  await db.delete();
  await db.open();
}
