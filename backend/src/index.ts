import { createApp } from "./app.js";
import { config } from "./config.js";
import { getSchema } from "./schema/loadSchema.js";

async function main(): Promise<void> {
  try {
    await getSchema(config.mefSchemaPath);
  } catch (err) {
    console.error("Failed to load MEF schema during startup:", err);
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`MEF AI Copilot backend listening on port ${config.port}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${config.port} is already in use.`);
    } else {
      console.error("Failed to start HTTP server:", err);
    }
    process.exit(1);
  });
}

main();
