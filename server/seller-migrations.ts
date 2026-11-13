import { sql, authDatabase } from './db.ts'
import type Database from 'better-sqlite3'

/** Retain the store and purchase ledger when its owner closes their account. */
export async function migrateSeller() {
  if (sql.dialect === 'sqlite') {
    const db = authDatabase as unknown as Database.Database
    const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'seller_store'").get() as { sql: string }
    if (/"?userId"? TEXT NOT NULL/.test(schema.sql)) {
      db.pragma('foreign_keys = OFF')
      try {
        db.transaction(() => {
          db.exec(schema.sql.replace('seller_store', 'seller_store_retained').replace(/"?userId"? TEXT NOT NULL UNIQUE REFERENCES "user"\(id\) ON DELETE CASCADE/, '"userId" TEXT UNIQUE REFERENCES "user"(id) ON DELETE SET NULL'))
          db.exec('INSERT INTO seller_store_retained SELECT * FROM seller_store; DROP TABLE seller_store; ALTER TABLE seller_store_retained RENAME TO seller_store; CREATE INDEX seller_store_account ON seller_store ("stripeAccountId");')
          if ((db.pragma('foreign_key_check') as unknown[]).length) throw new Error('Seller retention migration failed integrity check')
        })()
      } finally { db.pragma('foreign_keys = ON') }
    }
  } else {
    await sql.tx(async tx => {
      const constraints = await tx.all<{ name: string }>(`SELECT conname AS name FROM pg_constraint WHERE conrelid = 'seller_store'::regclass AND contype = 'f' AND confrelid = '"user"'::regclass`)
      for (const c of constraints) await tx.exec(`ALTER TABLE seller_store DROP CONSTRAINT "${c.name.replace(/"/g, '""')}"`)
      await tx.exec('ALTER TABLE seller_store ALTER COLUMN "userId" DROP NOT NULL; ALTER TABLE seller_store ADD CONSTRAINT seller_store_owner FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE SET NULL;')
    })
  }
  for (const [table, columns] of Object.entries({
    email_outbox: { providerId: 'TEXT', deliveredAt: 'BIGINT', bouncedAt: 'BIGINT' },
    seller_store: { revision: 'INTEGER NOT NULL DEFAULT 0', stripeMode: "TEXT NOT NULL DEFAULT 'test'", payments: 'TEXT' },
    seller_product: { revision: 'INTEGER NOT NULL DEFAULT 0', extras: 'TEXT', pubExtras: 'TEXT', archived: 'INTEGER NOT NULL DEFAULT 0', sampleFileId: 'TEXT', sampleName: 'TEXT', sampleSize: 'INTEGER', pubSampleFileId: 'TEXT', pubSampleName: 'TEXT' },
    seller_order: { checkoutKey: 'TEXT', checkoutUrl: 'TEXT', receiptId: 'INTEGER', paymentIntent: 'TEXT', refunded: 'INTEGER NOT NULL DEFAULT 0', disputed: 'INTEGER NOT NULL DEFAULT 0', stripeMode: "TEXT NOT NULL DEFAULT 'test'", method: "TEXT NOT NULL DEFAULT 'stripe'", reference: 'TEXT', providerOrderId: 'TEXT', buyerClaimedAt: 'TEXT', payerName: 'TEXT', payerBank: 'TEXT', payTo: 'TEXT', sellerHidden: 'INTEGER NOT NULL DEFAULT 0', listMinor: 'INTEGER', discountMinor: 'INTEGER NOT NULL DEFAULT 0', couponCode: 'TEXT', couponId: 'TEXT', resendCount: 'INTEGER NOT NULL DEFAULT 0', resendAt: 'TEXT', receiptError: 'TEXT' },
  })) {
    const existing = sql.dialect === 'sqlite'
      ? await sql.all<{ name: string }>(`PRAGMA table_info(${table})`)
      : await sql.all<{ name: string }>('SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?', table)
    for (const [name, type] of Object.entries(columns)) if (!existing.some(c => c.name === name)) await sql.exec(`ALTER TABLE ${table} ADD COLUMN "${name}" ${type}`)
  }
  // One Desknoty order per PayPal order and per bank reference: duplicate notifications can't fork an order.
  await sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS seller_order_provider ON seller_order ("providerOrderId") WHERE "providerOrderId" IS NOT NULL; CREATE UNIQUE INDEX IF NOT EXISTS seller_order_reference ON seller_order (reference) WHERE reference IS NOT NULL;')
  await sql.exec('CREATE UNIQUE INDEX IF NOT EXISTS seller_checkout_key ON seller_order ("storeId", "checkoutKey"); CREATE TABLE IF NOT EXISTS seller_connections ("storeId" TEXT NOT NULL REFERENCES seller_store(id), mode TEXT NOT NULL, "accountId" TEXT NOT NULL, PRIMARY KEY ("storeId", mode));')
  // Stage C: what each order grants (bundle items), snapshotted at purchase so later bundle edits never remove access.
  await sql.exec('CREATE TABLE IF NOT EXISTS seller_entitlement ("orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, title TEXT NOT NULL, "fileId" TEXT NOT NULL, "fileName" TEXT NOT NULL, PRIMARY KEY ("orderId", "productId"))')
  await sql.exec('CREATE TABLE IF NOT EXISTS mail_event (id TEXT PRIMARY KEY, type TEXT NOT NULL, "receivedAt" BIGINT NOT NULL)')
  await sql.run('INSERT INTO seller_connections ("storeId", mode, "accountId") SELECT id, "stripeMode", "stripeAccountId" FROM seller_store WHERE "stripeAccountId" IS NOT NULL ON CONFLICT DO NOTHING')
}
