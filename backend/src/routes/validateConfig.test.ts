import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { errorHandler } from "../app.js";
import { __resetSchemaCacheForTests } from "../schema/loadSchema.js";
import { __resetValidatorCacheForTests } from "../validation/validateConfig.js";
import { validateConfigRouter } from "./validateConfig.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(validateConfigRouter);
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  __resetSchemaCacheForTests();
  __resetValidatorCacheForTests();
});

describe("POST /tools/validate-mef-config", () => {
  it("returns 200 with an empty errors array for a valid config", async () => {
    const res = await request(buildApp())
      .post("/tools/validate-mef-config")
      .send({ modelName: "my-model", modelType: "PythonModel" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ errors: [] });
  });

  it("returns 200 with the violated field's errors for an invalid config", async () => {
    const res = await request(buildApp())
      .post("/tools/validate-mef-config")
      .send({ modelName: "Invalid Name!", modelType: "PythonModel" });

    expect(res.status).toBe(200);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "/modelName" })]),
    );
  });

  it("returns 400 for an unparseable JSON body", async () => {
    const res = await request(buildApp())
      .post("/tools/validate-mef-config")
      .set("Content-Type", "application/json")
      .send("{not valid json");

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });
});
