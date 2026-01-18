// Yes, this file is called instrumentation.ts, but it's not actually used to instrument the app.
// Apparently, this is the suggested way to run startup hooks in Next.js:
// https://github.com/vercel/next.js/discussions/15341#discussioncomment-7091594
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config.ts");
  }

  // prevent this from running in the edge runtime for the second time
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { Feature, isFeatureEnabled } = await import("@/lib/features/features.ts");
    if (isFeatureEnabled(Feature.LOCAL_DB)) {
      const { sql } = await import("drizzle-orm");
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      const { llmPrices, subscriptionTiers } = await import("@/lib/db/migrations/schema.ts");
      const { db } = await import("@/lib/db/drizzle.ts");

      const initializeData = async () => {
        const initialData = require("@/lib/db/initial-data.json");
        for (const entry of initialData) {
          const tableName: string = entry.table;
          const tables: Record<string, any> = {
            subscription_tiers: subscriptionTiers,
            llm_prices: llmPrices,
          };
          const table = tables[tableName];
          const rows: Record<string, unknown>[] = entry.data.map((row: Record<string, unknown>) =>
            Object.fromEntries(
              Object.entries(row).map(([k, v]) =>
                // camelCase the keys for drizzle
                [k.replace(/(_[a-z])/g, (m) => m[1].toUpperCase()), v]
              )
            )
          );

          await db
            .insert(table)
            .values(rows)
            .onConflictDoUpdate({
              target: table.id,
              set: Object.fromEntries(Object.keys(entry.data[0]).map((key) => [key, sql.raw(`excluded.${key}`)])),
            });
        }
      };

      const initializeClickHouse = async () => {
        try {
          const { migration } = await import("clickhouse-migrations");
          const { join } = await import("path");

          const migrationsHome = join(process.cwd(), "lib/clickhouse/migrations");

          // In Docker, use service name instead of localhost
          const clickhouseUrl = process.env.CLICKHOUSE_URL || 
            (process.env.RUNNING_IN_DOCKER ? "http://clickhouse:8123" : "http://localhost:8123");

          await migration(
            migrationsHome,
            clickhouseUrl,
            process.env.CLICKHOUSE_USER || "ch_user",
            process.env.CLICKHOUSE_PASSWORD || "ch_passwd",
            process.env.CLICKHOUSE_DB || "default",
            "ENGINE=Atomic", // db_engine
            String(Number(process.env.CH_MIGRATIONS_TIMEOUT) || 30000), // timeout as string
          );
        } catch (error) {
          console.error("Failed to apply ClickHouse migrations:", error);
          // Don't throw - allow app to continue
        }
      };

      // Run Postgres migrations and data initialization with error handling
      try {
        await db.execute("ALTER DATABASE postgres REFRESH COLLATION VERSION");
        await migrate(db as any, { migrationsFolder: "lib/db/migrations" });
        console.log("✓ Postgres migrations applied successfully");
        await initializeData();
        console.log("✓ Postgres data initialized successfully");
      } catch (error: any) {
        const errMsg = String(error?.message || error);
        if (errMsg.includes("ECONNREFUSED") || errMsg.includes("connection") || errMsg.includes("connect")) {
          console.warn("Database not available yet, skipping migrations. They will be applied on next restart.");
        } else {
          console.error("Failed to apply Postgres migrations:", error);
          // Don't throw - allow app to continue
        }
      }

      // Run ClickHouse schema application
      console.log("Applying ClickHouse schema. This may take a while...");
      try {
        await initializeClickHouse();
        console.log("✓ ClickHouse schema applied successfully");
      } catch (error: any) {
        const errMsg = String(error?.message || error);
        if (errMsg.includes("a migration file should't be changed after apply")) {
          console.warn(
            "ClickHouse migrations already applied or migration file has changed after apply. Assuming ClickHouse is already configured."
          );
        } else if (errMsg.includes("ECONNREFUSED") || errMsg.includes("connection")) {
          console.warn("ClickHouse not available yet, skipping schema application. It will be applied on next restart.");
        } else {
          console.log("Failed to apply ClickHouse schema:", error);
        }
      }

      // Run Quickwit index initialization
      const initializeQuickwit = async () => {
        if (!process.env.QUICKWIT_SEARCH_URL) {
          console.warn("Skipping Quickwit initialization: QUICKWIT_SEARCH_URL is not set.");
          return;
        }
        try {
          const { initializeQuickwitIndexes } = await import("@/lib/quickwit/migrations.ts");
          await initializeQuickwitIndexes();
        } catch (error: any) {
          const errMsg = String(error?.message || error);
          if (errMsg.includes("ECONNREFUSED") || errMsg.includes("connection") || errMsg.includes("connect")) {
            console.warn("Quickwit not available yet, skipping index initialization. It will be applied on next restart.");
          } else {
            console.error("Failed to initialize Quickwit indexes:", error);
            console.log("Continuing without Quickwit indexes...");
          }
        }
      };
      await initializeQuickwit();
    } else {
      console.log("Local DB is not enabled, skipping migrations and initial data");
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
