import { generateConfigTemplate } from "../config-template/generateConfigTemplate.js";
import { isPlainObject } from "../schema/schemaUtils.js";
import { getFieldInfo, listFields } from "../schema-info/getSchemaInfo.js";
import { validateConfig } from "../validation/validateConfig.js";
import type { AgentTool } from "./types.js";

function createValidateMefConfigTool(schemaPath: string): AgentTool {
  return {
    definition: {
      name: "validate_mef_config",
      description:
        "Validates a MEF config document against the MEF JSON Schema, returning a list of field-level errors (empty when the config is valid).",
      parameters: {
        type: "object",
        properties: {
          config: {
            type: "object",
            description: "The MEF config document to validate.",
          },
        },
        required: ["config"],
      },
    },
    async execute(args: unknown): Promise<unknown> {
      if (!isPlainObject(args) || !("config" in args)) {
        throw new Error("validate_mef_config requires a 'config' argument");
      }
      const errors = await validateConfig(schemaPath, args.config);
      return { errors };
    },
  };
}

function createGetSchemaInfoTool(schemaPath: string): AgentTool {
  return {
    definition: {
      name: "get_schema_info",
      description:
        "Looks up metadata for a MEF config field by JSON Pointer (type, required, constraints) and lists the fields declared directly under it. Omit the pointer to list the schema's top-level fields.",
      parameters: {
        type: "object",
        properties: {
          pointer: {
            type: "string",
            description:
              "JSON Pointer (RFC 6901) to the field, e.g. \"/modelName\" or \"/runtime/kind\". Omit to list top-level fields.",
          },
        },
      },
    },
    async execute(args: unknown): Promise<unknown> {
      if (args !== undefined && !isPlainObject(args)) {
        throw new Error("get_schema_info requires an object argument");
      }
      const pointer = isPlainObject(args) ? args.pointer : undefined;
      if (pointer !== undefined && typeof pointer !== "string") {
        throw new Error("get_schema_info's 'pointer' argument must be a string");
      }

      const field = pointer !== undefined ? await getFieldInfo(schemaPath, pointer) : undefined;
      const fields = await listFields(schemaPath, pointer);
      return { field, fields };
    },
  };
}

function createGenerateConfigTemplateTool(schemaPath: string): AgentTool {
  return {
    definition: {
      name: "generate_config_template",
      description:
        "Generates a minimal, schema-valid MEF config with every required field placeholder-filled. Optionally accepts field-value overrides by JSON Pointer.",
      parameters: {
        type: "object",
        properties: {
          overrides: {
            type: "object",
            description: "Map of JSON Pointer to override value, e.g. { \"/modelName\": \"my-model\" }.",
          },
        },
      },
    },
    async execute(args: unknown): Promise<unknown> {
      if (args !== undefined && !isPlainObject(args)) {
        throw new Error("generate_config_template requires an object argument");
      }
      const overrides = isPlainObject(args) ? args.overrides : undefined;
      if (overrides !== undefined && !isPlainObject(overrides)) {
        throw new Error("generate_config_template's 'overrides' argument must be an object");
      }

      return generateConfigTemplate(schemaPath, overrides as Record<string, unknown> | undefined);
    },
  };
}

/** Builds the three MEF agent tools, bound to the given MEF schema path. */
export function createAgentTools(schemaPath: string): AgentTool[] {
  return [
    createValidateMefConfigTool(schemaPath),
    createGetSchemaInfoTool(schemaPath),
    createGenerateConfigTemplateTool(schemaPath),
  ];
}
