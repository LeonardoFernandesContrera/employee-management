import "dotenv/config";

import { createApp } from "./app";
import { parseEnvironment } from "./config/appConfig";

try {
  const config = parseEnvironment(process.env);
  const app = createApp(config);
  const server = app.listen(config.port, () => {
    console.info(`Server listening on port ${config.port}.`);
  });

  server.on("error", () => {
    console.error("Server startup failed.");
    process.exitCode = 1;
  });
} catch {
  console.error("Server startup failed.");
  process.exitCode = 1;
}
