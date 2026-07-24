import { openDatabase } from "@models-roundtable/db";
import { buildServer } from "./app.js";
import { loadServerConfig } from "./config.js";

const config = loadServerConfig();
const database = openDatabase({ dataDirectory: config.dataDirectory });
const server = await buildServer({ config, database });

async function shutdown(exitCode: number): Promise<void> {
  await server.close();
  database.close();
  process.exit(exitCode);
}

process.once("SIGINT", () => {
  void shutdown(0);
});
process.once("SIGTERM", () => {
  void shutdown(0);
});

try {
  await server.listen({ host: config.host, port: config.port });
} catch (error) {
  console.error("Models Roundtable server could not start.", error);
  await shutdown(1);
}
