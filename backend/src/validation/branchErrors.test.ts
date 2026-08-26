import type { ErrorObject } from "ajv-draft-04";
import { describe, expect, it } from "vitest";
import { attributeUnionErrors } from "./branchErrors.js";

function err(partial: Partial<ErrorObject>): ErrorObject {
  return {
    instancePath: "",
    schemaPath: "",
    keyword: "type",
    params: {},
    message: "",
    ...partial,
  } as ErrorObject;
}

describe("attributeUnionErrors", () => {
  it("keeps only the enum-discriminated branch's errors and drops the generic union error", () => {
    const errors = [
      err({
        instancePath: "/app",
        schemaPath: "#/properties/app/oneOf/0/required",
        keyword: "required",
        message: "must have required property 'image'",
        params: { missingProperty: "image" },
      }),
      err({
        instancePath: "/app/deployStrategy",
        schemaPath: "#/properties/app/oneOf/1/properties/deployStrategy/enum",
        keyword: "enum",
        message: "must be equal to one of the allowed values",
      }),
      err({
        instancePath: "/app",
        schemaPath: "#/properties/app/oneOf",
        keyword: "oneOf",
        message: "must match exactly one schema in oneOf",
      }),
    ];

    const result = attributeUnionErrors(errors);

    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("must have required property 'image'");
  });

  it("keeps the required-property-discriminated branch with fewer errors", () => {
    const errors = [
      err({
        instancePath: "/secret/valueFrom",
        schemaPath: "#/properties/secret/valueFrom/oneOf/0/required",
        keyword: "required",
        message: "must have required property 'vaultSecretRef'",
        params: { missingProperty: "vaultSecretRef" },
      }),
      err({
        instancePath: "/secret/valueFrom",
        schemaPath: "#/properties/secret/valueFrom/oneOf/1/required",
        keyword: "required",
        message: "must have required property 'vaultADSecretRef'",
        params: { missingProperty: "vaultADSecretRef" },
      }),
      err({
        instancePath: "/secret/valueFrom",
        schemaPath: "#/properties/secret/valueFrom/oneOf",
        keyword: "oneOf",
        message: "must match exactly one schema in oneOf",
      }),
    ];

    const result = attributeUnionErrors(errors);

    // Tied on error count and neither has an enum mismatch: deterministic
    // (first-seen) tiebreak, but there must be exactly one branch's worth
    // of errors left, and the generic union error must be gone either way.
    expect(result).toHaveLength(1);
    expect(result[0].keyword).toBe("required");
  });

  it("resolves a nested union (inside a losing outer branch) before the outer union, discarding it entirely", () => {
    const errors = [
      // Outer branch 0 (Keytab): has its own nested union that resolves to 1 error.
      err({
        instancePath: "/secret/valueFrom",
        schemaPath:
          "#/properties/secret/oneOf/0/properties/valueFrom/oneOf/0/required",
        keyword: "required",
        message: "must have required property 'vaultSecretRef'",
      }),
      err({
        instancePath: "/secret/valueFrom",
        schemaPath:
          "#/properties/secret/oneOf/0/properties/valueFrom/oneOf/1/required",
        keyword: "required",
        message: "must have required property 'vaultADSecretRef'",
      }),
      err({
        instancePath: "/secret/valueFrom",
        schemaPath: "#/properties/secret/oneOf/0/properties/valueFrom/oneOf",
        keyword: "oneOf",
        message: "must match exactly one schema in oneOf",
      }),
      // Outer branch 1 (BasicAuth): discriminator mismatch, config's
      // valueType is "Keytab" so branch 1's enum check fails.
      err({
        instancePath: "/secret/valueType",
        schemaPath: "#/properties/secret/oneOf/1/properties/valueType/enum",
        keyword: "enum",
        message: "must be equal to one of the allowed values",
      }),
      err({
        instancePath: "/secret",
        schemaPath: "#/properties/secret/oneOf",
        keyword: "oneOf",
        message: "must match exactly one schema in oneOf",
      }),
    ];

    const result = attributeUnionErrors(errors);

    // Branch 0 (Keytab) is the intended branch (no enum mismatch), so its
    // single already-resolved nested-union error survives, and branch 1's
    // enum-mismatch error and both generic union errors are gone.
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe("must have required property 'vaultSecretRef'");
  });

  it("leaves non-union errors untouched", () => {
    const errors = [
      err({
        instancePath: "/other",
        schemaPath: "#/properties/other/type",
        keyword: "type",
        message: "must be string",
      }),
    ];

    expect(attributeUnionErrors(errors)).toEqual(errors);
  });

  it("always drops the generic oneOf/anyOf error itself, even alongside unrelated errors", () => {
    const errors = [
      err({
        instancePath: "/other",
        schemaPath: "#/properties/other/type",
        keyword: "type",
        message: "must be string",
      }),
      err({
        instancePath: "/u",
        schemaPath: "#/properties/u/oneOf/0/required",
        keyword: "required",
        message: "must have required property 'x'",
      }),
      err({
        instancePath: "/u",
        schemaPath: "#/properties/u/oneOf",
        keyword: "oneOf",
        message: "must match exactly one schema in oneOf",
      }),
    ];

    const result = attributeUnionErrors(errors);

    expect(result.some((e) => e.keyword === "oneOf")).toBe(false);
    expect(result).toHaveLength(2);
  });
});
