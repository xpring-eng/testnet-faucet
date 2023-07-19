export interface Config {
  NODE_ENV: "production" | "development"
  PORT: string
  RIPPLED_URI: string
  FUNDING_ADDRESS: string
  FUNDING_SECRET: string
  XRP_AMOUNT: string
  MAX_AMOUNT: string
  MIN_TICKET_COUNT: number
  MAX_TICKET_COUNT: number

  BIGQUERY_DATASET_ID?: string
  BIGQUERY_TABLE_ID?: string
  BIGQUERY_CLIENT_EMAIL?: string
  BIGQUERY_PROJECT_ID?: string
  BIGQUERY_PRIVATE_KEY?: string
}

const required: (keyof Config)[] = [
  'RIPPLED_URI',
  'FUNDING_SECRET'
]

const defaults: Partial<Record<keyof Partial<Config>, any>> = {
  PORT: '3000',
  XRP_AMOUNT: '10000',
  MAX_AMOUNT: '1000000',
  MIN_TICKET_COUNT: 100,
  MAX_TICKET_COUNT: 240,
}

const dotenv = require('dotenv')

const result = dotenv.config()

if (result.error) {
  throw result.error
}

const config = result.parsed;

// Validate required configuration options
required.forEach((field: string) => {
  if(!(field in config)) {
    throw new Error(`Config property ${field} is required`)
  }
});

(new Map(Object.entries(defaults))).forEach((value: string, key: any) => {
  if(!(key in config)) {
    config[key] = value
  }
})

export {
  config
}
