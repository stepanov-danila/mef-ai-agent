import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { errorHandler } from "../app.js";
import { __resetSchemaCacheForTests } from "../schema/loadSchema.js";
import { generateTemplateRouter } from "./generateTemplate.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(generateTemplateRouter);
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  __resetSchemaCacheForTests();
});

describe("POST /tools/generate-config-template", () => {
  it("returns 200 with a minimal template for an empty body", async () => {
    const res = await request(buildApp()).post("/tools/generate-config-template").send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ modelName: expect.any(String), modelType: "PythonModel" }),
    );
  });

  it("returns 200 and reflects a valid overrides object in the response", async () => {
    const res = await request(buildApp())
      .post("/tools/generate-config-template")
      .send({ overrides: { "/modelName": "my-custom-model" } });

    expect(res.status).toBe(200);
    expect(res.body.modelName).toBe("my-custom-model");
  });

  it("returns 400 when overrides is not an object", async () => {
    const res = await request(buildApp())
      .post("/tools/generate-config-template")
      .send({ overrides: "not-an-object" });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });
});
