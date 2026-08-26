import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxBin = path.join(backendDir, "node_modules", ".bin", "tsx");
const entrypoint = path.join(backendDir, "src", "index.ts");
const validSchemaPath = path.join(
  backendDir,
  "src",
  "schema",
  "__fixtures__",
  "valid-schema.json",
);

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        const { port } = address;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Could not determine free port")));
      }
    });
  });
}

interface RunResult {
  child: ChildProcessWithoutNullStreams;
  waitFor: (predicate: (chunk: string) => boolean, timeoutMs?: number) => Promise<string>;
  waitForExit: (timeoutMs?: number) => Promise<number | null>;
}

function run(env: NodeJS.ProcessEnv): RunResult {
  const child = spawn(tsxBin, [entrypoint], {
    cwd: backendDir,
    env: { ...process.env, ...env },
  });

  let combinedOutput = "";
  child.stdout.on("data", (chunk) => {
    combinedOutput += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    combinedOutput += chunk.toString();
  });

  const waitFor = (predicate: (chunk: string) => boolean, timeoutMs = 15_000) =>
    new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Timed out waiting for expected output. Output so far:\n${combinedOutput}`,
          ),
        );
      }, timeoutMs);

      const check = () => {
        if (predicate(combinedOutput)) {
          clearTimeout(timer);
          resolve(combinedOutput);
        }
      };

      child.stdout.on("data", check);
      child.stderr.on("data", check);
      check();
    });

  const waitForExit = (timeoutMs = 15_000) =>
    new Promise<number | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for process exit. Output:\n${combinedOutput}`));
      }, timeoutMs);
      child.on("exit", (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });

  return { child, waitFor, waitForExit };
}

const runningChildren: ChildProcessWithoutNullStreams[] = [];

afterEach(() => {
  for (const child of runningChildren.splice(0)) {
    if (!child.killed) child.kill();
  }
});

describe("backend entrypoint (src/index.ts)", () => {
  it(
    "starts and logs a listening message with a valid schema and a free port",
    async () => {
      const port = await getFreePort();
      const { child, waitFor } = run({
        PORT: String(port),
        MEF_SCHEMA_PATH: validSchemaPath,
      });
      runningChildren.push(child);

      await waitFor((out) => /listening on port/i.test(out));
    },
    20_000,
  );

  it(
    "exits non-zero with a descriptive error when the schema path is invalid",
    async () => {
      const port = await getFreePort();
      const { child, waitForExit, waitFor } = run({
        PORT: String(port),
        MEF_SCHEMA_PATH: path.join(backendDir, "src", "schema", "__fixtures__", "does-not-exist.json"),
      });
      runningChildren.push(child);

      const output = await waitFor((out) => /Failed to load MEF schema/i.test(out));
      expect(output).not.toMatch(/listening on port/i);

      const code = await waitForExit();
      expect(code).toBe(1);
    },
    20_000,
  );

  it(
    "exits non-zero with a descriptive error when the port is already in use",
    async () => {
      const port = await getFreePort();

      const first = run({ PORT: String(port), MEF_SCHEMA_PATH: validSchemaPath });
      runningChildren.push(first.child);
      await first.waitFor((out) => /listening on port/i.test(out));

      const second = run({ PORT: String(port), MEF_SCHEMA_PATH: validSchemaPath });
      runningChildren.push(second.child);

      const output = await second.waitFor((out) => /already in use/i.test(out));
      expect(output).toMatch(/already in use/i);

      const code = await second.waitForExit();
      expect(code).toBe(1);
    },
    20_000,
  );
});
