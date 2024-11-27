import { GoogleGenerativeAI, type EnhancedGenerateContentResponse, type GenerationConfig } from "@google/generative-ai";
import { API_FLASH_ACCESS_KEY, GEMINI_API_KEY, R2_CONFIG } from "./config.js";
import fs from "fs/promises";
import path from "path";
import { GoogleAIFileManager, type FileMetadataResponse } from "@google/generative-ai/server";
import geminiPrompts from "./prompts.json";
import responseSchema from './responseSchema.json';

const GEN_AI = new GoogleGenerativeAI(GEMINI_API_KEY);
const AI_FILE_MANAGER = new GoogleAIFileManager(GEMINI_API_KEY);

export async function getAndStoreScreenshot(url: string): Promise<{ fileName: string, filePath: string }> {
    console.time("getAndStoreScreenshot");

    try {
        // Validate URL
        if (!url) {
            console.error("URL is required");
            throw new Error("URL is required");
        }

        const parsedUrl = new URL(url);

        // Generate file name
        const fileName = `${parsedUrl.hostname}-${Date.now()}.webp`;

        // Build query parameters
        const params = new URLSearchParams({
            access_key: API_FLASH_ACCESS_KEY,
            url,
            fresh: "false",
            format: "webp",
            extract_html: "false",
            full_page: "true",
            scroll_page: "true",
            response_type: "json",
            no_cookie_banners: "true",
            no_tracking: "true",
            wait_until: "page_loaded",
            s3_endpoint: R2_CONFIG.endpoint,
            s3_region: R2_CONFIG.region,
            s3_access_key_id: R2_CONFIG.accessKeyId,
            s3_secret_key: R2_CONFIG.secretAccessKey,
            s3_bucket: R2_CONFIG.bucketName,
            s3_key: fileName,
        });
        console.info(`Requesting screenshot for ${url}`);
        const reqUrl = `https://api.apiflash.com/v1/urltoimage?${params.toString()}`;

        // Fetch screenshot metadata
        const response = await fetch(reqUrl);
        if (!response.ok) {
            console.error("Failed to fetch screenshot metadata:", response.statusText);
            throw new Error("Failed to fetch screenshot metadata");
        }
        const result = await response.json();
        if (!result.url) {
            console.error("Invalid API response: missing URL", result);
            throw new Error("Invalid API response: missing URL");
        }

        // Fetch and save the screenshot
        const snapshot = await fetch(result.url);
        if (!snapshot.ok) {
            console.error("Failed to fetch screenshot:", snapshot.statusText);
            throw new Error("Failed to fetch screenshot");
        }
        const buffer = await snapshot.arrayBuffer();
        const filePath = path.resolve("./ss/", fileName);
        await fs.writeFile(filePath, Buffer.from(buffer));
        console.log("Screenshot saved to:", filePath);

        return { filePath, fileName };
    } catch (error) {
        console.error("Error capturing screenshot:", error);
        throw error;
    } finally {
        console.timeEnd("getAndStoreScreenshot");
    }
}

/**
 * Uploads the given file to Gemini.
 *
 */
export async function uploadToGemini(path: string, mimeType: string): Promise<FileMetadataResponse> {
    const uploadResult = await AI_FILE_MANAGER.uploadFile(path, {
        mimeType,
        displayName: path,
    });
    const file = uploadResult.file;
    console.log(`Uploaded file ${file.displayName} as: ${file.name}`);
    return file;
}

export async function runAI(filePath: string) {

    try {

        console.time("runAI");
        // Validate URL
        if (!filePath) {
            console.error("File path is required");
            return false;
        }


        // Step 2: Upload Screenshot to Gemini
        console.log("Uploading screenshot to Gemini...");
        const fileUpload = await uploadToGemini(filePath, "image/webp");
        if (!fileUpload || !fileUpload.uri || !fileUpload.mimeType) {
            console.error("Failed to upload file to Gemini");
            return false;
        }
        console.log("Screenshot uploaded to Gemini:", fileUpload.uri);

        // Step 3: Configure AI Model
        const model = GEN_AI.getGenerativeModel({
            model: "gemini-1.5-flash",
        });

        const generationConfig = {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema,
        } as GenerationConfig;

        // Step 4: Start Chat Session
        const chatSession = model.startChat({
            generationConfig,
            history: [
                {
                    role: "user",
                    parts: [
                        {
                            fileData: {
                                mimeType: fileUpload.mimeType,
                                fileUri: fileUpload.uri,
                            },
                        },
                        {
                            text: geminiPrompts.gemini.v2,
                        },
                    ],
                },
            ],
        });

        // Step 5: Send Message and Get Response
        const { response } = await chatSession.sendMessage(
            "Analyze the page, Keep the response short and concise."
        );

        if (!response) {
            console.error("No response from AI model");
            return false;
        }

        // Step 6: Save Response to File (only on local)
        // const outputPath = path.resolve('./ai-response/', `response-${Date.now()}.json`);
        // await fs.writeFile(outputPath, JSON.stringify(response, null, 2));
        // console.log(`Response saved to ${outputPath}`);

        return response;
    } catch (error) {
        console.error("Error in runAI:", error);
        return false;
    } finally {
        console.timeEnd("runAI");
    }
}