import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(__dirname, "../../../..");
const read = (path: string): string => readFileSync(resolve(repositoryRoot, path), "utf8");

describe("Docker production contract", () => {
  test("uses compiled project-scoped production contracts", () => {
    const backendDockerfile = read("backend/dockerfile");
    const frontendDockerfile = read("frontend/dockerfile");
    const compose = read("docker-compose.yml");

    expect(backendDockerfile).toContain("node dist/database/seed.js");
    expect(backendDockerfile).toContain("exec node dist/server.js");
    expect(backendDockerfile).toContain(
      'CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/database/seed.js && exec node dist/server.js"]',
    );
    expect(backendDockerfile).toContain("USER node");
    expect(frontendDockerfile).toContain("ARG VITE_API_BASE_URL");
    expect(frontendDockerfile).toContain("USER node");
    expect(frontendDockerfile).toContain("node_modules/.bin/serve");
    expect(compose).not.toMatch(/container_name:|restart:\s*always|command:\s/u);
    expect(compose.match(/dockerfile: dockerfile/gu)).toHaveLength(2);
    expect(compose).toContain("VITE_API_BASE_URL:");
    expect(compose).toContain("condition: service_healthy");
  });
});
