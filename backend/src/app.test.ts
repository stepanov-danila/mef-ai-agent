import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, errorHandler } from "./app.js";

describe("createApp", () => {
  it("responds 200 with { status: \"ok\" } on GET /health", async () => {
    const app = createApp();

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("keeps serving requests after a handler throws, returning 5xx", async () => {
    const app = express();
    app.get("/boom-sync", () => {
      throw new Error("boom");
    });
    app.get("/boom-async", async () => {
      await Promise.resolve();
      throw new Error("boom");
    });
    app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
    app.use(errorHandler);

    const syncRes = await request(app).get("/boom-sync");
    expect(syncRes.status).toBeGreaterThanOrEqual(500);
    expect(syncRes.status).toBeLessThan(600);

    const asyncRes = await request(app).get("/boom-async");
    expect(asyncRes.status).toBeGreaterThanOrEqual(500);
    expect(asyncRes.status).toBeLessThan(600);

    // The process/app keeps serving subsequent requests normally.
    const healthRes = await request(app).get("/health");
    expect(healthRes.status).toBe(200);
  });

  it("honors an error's own status, falling back to 500 when unset", async () => {
    const app = express();
    app.get("/client-error", () => {
      const err = Object.assign(new Error("bad input"), { status: 400 });
      throw err;
    });
    app.get("/boom-sync", () => {
      throw new Error("boom");
    });
    app.use(errorHandler);

    const clientErrorRes = await request(app).get("/client-error");
    expect(clientErrorRes.status).toBe(400);
    expect(clientErrorRes.body).toEqual({ error: "bad input" });

    const genericRes = await request(app).get("/boom-sync");
    expect(genericRes.status).toBe(500);
    expect(genericRes.body).toEqual({ error: "boom" });
  });

  it("wires up the agent tool routes (smoke test)", async () => {
    const app = createApp();

    const validateRes = await request(app)
      .post("/tools/validate-mef-config")
      .send({ modelName: "my-model", modelType: "PythonModel" });
    expect(validateRes.status).not.toBe(404);

    const fieldRes = await request(app).get(
      "/tools/get-schema-info/field?pointer=/modelName",
    );
    expect(fieldRes.status).not.toBe(404);

    const generateRes = await request(app).post("/tools/generate-config-template").send();
    expect(generateRes.status).not.toBe(404);
  });
});
