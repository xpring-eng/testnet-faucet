import dotenv, { DotenvParseOutput } from "dotenv";

export interface ConfigFile {
  NODE_ENV?: "production" | "development";
  PORT?: string;
  RIPPLED_URI: string;
  FUNDING_ADDRESS?: string;
  FUNDING_SECRET: string;
  XRP_AMOUNT?: string;
  MAX_AMOUNT?: string;
  MIN_TICKET_COUNT?: number;
  MAX_TICKET_COUNT?: number;

  CASPIAN_API_KEY?: string;
  CASPIAN_ENDPOINT?: string;
  CASPIAN_ENTITY_NAME?: string;
  CASPIAN_PRODUCER_NAME?: string;
  CASPIAN_SCHEMA_TYPE?: string;
  CASPIAN_SCHEMA_VERSION?: number;
}

export interface Config extends Required<ConfigFile> {}

const required: (keyof ConfigFile)[] = ["RIPPLED_URI", "FUNDING_SECRET"];

const defaults: Partial<Record<keyof Partial<ConfigFile>, any>> = {
  PORT: "3000",
  XRP_AMOUNT: "10000",
  MAX_AMOUNT: "1000000",
  MIN_TICKET_COUNT: 100,
  MAX_TICKET_COUNT: 240,
};

const result = dotenv.config();

if (result.error) {
  throw result.error;
}

let config: DotenvParseOutput & typeof defaults = {
  ...defaults,
  ...result.parsed,
};

// Validate required configuration options
required.forEach((field) => {
  if (!(field in config)) {
    throw new Error(`Config property ${field} is required`);
  }
});

// Ensure config is treated as fully resolved Config, not ConfigFile
const finalConfig: Config = config as Config;

export { finalConfig as config };
