import "dotenv/config";

export interface Config {
  port: number;
  mefSchemaPath: string;
}

export function readConfig(env: NodeJS.ProcessEnv): Config {
  const mefSchemaPath = env.MEF_SCHEMA_PATH;
  if (!mefSchemaPath) {
    throw new Error("MEF_SCHEMA_PATH environment variable is required");
  }

  return {
    port: env.PORT ? Number(env.PORT) : 3000,
    mefSchemaPath,
  };
}

export const config = readConfig(process.env);
