import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { errorHandler } from "../app.js";
import { __resetSchemaCacheForTests } from "../schema/loadSchema.js";
import { schemaInfoRouter } from "./schemaInfo.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(schemaInfoRouter);
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  __resetSchemaCacheForTests();
});

describe("GET /tools/get-schema-info/field", () => {
  it("returns 200 with the field's metadata for an existing field", async () => {
    const res = await request(buildApp()).get(
      "/tools/get-schema-info/field?pointer=/modelName",
    );

    expect(res.status).toBe(200);
    expect(res.body.field).toEqual(
      expect.objectContaining({ path: "/modelName", required: true }),
    );
  });

  it("returns 404 for a pointer that does not resolve", async () => {
    const res = await request(buildApp()).get(
      "/tools/get-schema-info/field?pointer=/doesNotExist",
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it("returns 400 when the pointer query parameter is missing", async () => {
    const res = await request(buildApp()).get("/tools/get-schema-info/field");

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it("returns 400 for a malformed pointer", async () => {
    const res = await request(buildApp()).get(
      "/tools/get-schema-info/field?pointer=modelName",
    );

    expect(res.status).toBe(400);
  });
});

describe("GET /tools/get-schema-info/list", () => {
  it("lists every top-level field when no pointer is given", async () => {
    const res = await request(buildApp()).get("/tools/get-schema-info/list");

    expect(res.status).toBe(200);
    expect(res.body.fields.map((f: { path: string }) => f.path).sort()).toEqual(
      ["/modelName", "/modelType", "/runtime"].sort(),
    );
  });

  it("lists the fields declared directly under an object node", async () => {
    const res = await request(buildApp()).get(
      "/tools/get-schema-info/list?pointer=/runtime",
    );

    expect(res.status).toBe(200);
    expect(res.body.fields.map((f: { path: string }) => f.path)).toEqual(["/runtime/kind"]);
  });

  it("returns 400 for a malformed pointer", async () => {
    const res = await request(buildApp()).get(
      "/tools/get-schema-info/list?pointer=modelName",
    );

    expect(res.status).toBe(400);
  });
});
