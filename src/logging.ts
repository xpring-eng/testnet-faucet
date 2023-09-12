import { Account } from "./types";
import { BigQuery } from "@google-cloud/bigquery";
import { config } from "./config";

///Depending on your setup, you can use either Caspian or BigQuery for logging. Other databases may be added in the future
export async function insertIntoCaspian(
  account: Account,
  amount: number,
  reqBody: any,
  networkId: number
): Promise<any> {
  const dataPayload = [
    {
      user_agent: reqBody.userAgent || "",
      usage_context: reqBody.usageContext || "",
      memos: reqBody.memos || [],
      account: account.xAddress,
      amount: amount,
      network: networkId,
    },
  ];

  const postData = JSON.stringify({
    producerName: config.CASPIAN_PRODUCER_NAME,
    entityName: config.CASPIAN_ENTITY_NAME,
    schemaType: config.CASPIAN_SCHEMA_TYPE,
    schemaVersion: Math.round(config.CASPIAN_SCHEMA_VERSION),
    data: dataPayload,
    timestamp: Date.now(),
  });

  try {
    const response = await fetch(config.CASPIAN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.CASPIAN_API_KEY,
      },
      body: postData,
    });

    if (response.ok) {
      return await response.json();
    } else {
      const errorMessage = await response.text();
      throw new Error(`Failed to send data to Caspian: ${errorMessage}`);
    }
  } catch (error) {
    console.error("Request Error:", error);
    throw {
      message: `Failed to send data to Caspian: ${
        error.message || "Unknown error"
      }`,
      attemptedData: postData,
    };
  }
}

export async function insertIntoBigQuery(
  account: Account,
  amount: string,
  reqBody: any
): Promise<void> {
  const { userAgent = "", usageContext = "" } = reqBody;
  const memos = reqBody.memos
    ? reqBody.memos.map((memo: any) => ({ memo }))
    : [];
  const rows = [
    {
      user_agent: userAgent,
      usage_context: usageContext,
      memos: memos,
      account: account.xAddress,
      amount: amount,
    },
  ];
  const bigquery = new BigQuery({
    projectId: config.BIGQUERY_PROJECT_ID,
    credentials: {
      client_email: config.BIGQUERY_CLIENT_EMAIL,
      private_key: config.BIGQUERY_PRIVATE_KEY,
    },
  });

  return new Promise((resolve, reject) => {
    bigquery
      .dataset(config.BIGQUERY_DATASET_ID)
      .table(config.BIGQUERY_TABLE_ID)
      .insert(rows, (error) => {
        if (error) {
          console.warn(
            "WARNING: Failed to insert into BigQuery",
            JSON.stringify(error, null, 2)
          );
          reject(error);
        } else {
          console.log(`Inserted ${rows.length} rows`);
          resolve();
        }
      });
  });
}
