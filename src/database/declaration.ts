import { drizzle } from 'drizzle-orm/node-postgres'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { v4 as uuid } from 'uuid'

export const database = drizzle(process.env.database_url)

export const users_table = pgTable('users', {
  id: text().notNull().unique().primaryKey().default(uuid()),
  email: text().notNull().unique(),
  password: text(),
  provider: text(),
  provider_id: text()
})
