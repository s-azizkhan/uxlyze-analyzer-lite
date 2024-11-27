import dotenv from 'dotenv'
dotenv.config()

export const PORT = process.env.PORT as unknown as number || 3000;
export const MAX_JOBS_PER_MINUTE = process.env.MAX_JOBS_PER_MINUTE as unknown as number || 5;
export const DATABASE_URL = process.env.SUPABASE_DB_URL || '';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const GOOGLE_PAGE_SPEED_API_KEY = process.env.GOOGLE_PAGE_SPEED_API_KEY || '';
export const API_FLASH_ACCESS_KEY = process.env.API_FLASH_ACCESS_KEY || '';

export const R2_CONFIG = {
    bucketName: process.env.R2_BUCKET_NAME || "uxlyze-web-ss",
    accountId: process.env.R2_ACCOUNT_ID || "",
    endpoint: process.env.R2_ENDPOINT || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    signatureVersion: "v4",
    region: "auto",
}
