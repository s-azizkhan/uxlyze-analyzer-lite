import type { ReportData } from "./interfaces.js";
import { getAndStoreScreenshot, runAI } from './utils.js';
import { db } from "./index.js";
import { existsSync } from "fs";
import { MAX_JOBS_PER_MINUTE } from "./config.js";

const jobQueue: Array<{ reportId: string; reportData: ReportData }> = [];
let isProcessing = false;

// Rate limiting variables
let jobsProcessedInCurrentMinute = 0;
let processingStartTime = Date.now();

async function processQueue() {
    if (isProcessing || jobQueue.length === 0) return;

    const now = Date.now();
    const elapsedTime = now - processingStartTime;

    // Reset the counter every minute
    if (elapsedTime >= 60000) {
        jobsProcessedInCurrentMinute = 0;
        processingStartTime = now;
    }

    // Limit processing to MAX_JOBS_PER_MINUTE
    if (jobsProcessedInCurrentMinute >= MAX_JOBS_PER_MINUTE) {
        console.log('Rate limit reached, pausing processing...');
        return;
    }
    isProcessing = true;

    while (jobQueue.length > 0) {
        const job = jobQueue.shift(); // Dequeue a job
        if (!job) continue;

        const { reportId, reportData } = job;
        console.log(`Analyzing report ${reportId} for ${reportData.web_url}`);

        try {
            console.time("processQueue")

            // Process the job (similar to the worker logic from the Redis example)
            const { filePath, fileName } = await getAndStoreScreenshot(reportData.web_url);
            // check if file exists
            if (!existsSync(filePath)) {
                console.error("Screenshot file does not exist:", filePath);
                throw new Error("Screenshot file does not exist");
            }

            const aiRes = await runAI(filePath);
            if (!aiRes || !aiRes?.candidates) throw new Error('AI analysis failed');

            const aiParsedRes = JSON.parse(aiRes?.candidates[0]?.content?.parts[0]?.text || '{}');

            const reportResult = {
                SEO: {},
                URL: reportData.web_url,
                Title: `UI/UX Analysis Report for ${reportData.web_url}`,
                FontUsage: {
                    "fontsUsed": {
                    },
                    "totalFonts": 0,
                    "fontSizeDistribution": {
                    }
                },
                ColorUsage: {
                    "colors": [
                    ],
                    "totalColors": 0
                },
                Navigation: {
                    "totalLinks": 0,
                    "linkStructure": {
                        "externalLinks": [],
                        "internalLinks": []
                    },
                    "navElementCount": 0,
                    "linksWithoutHref": 0,
                    "externalLinksCount": 0,
                    "internalLinksCount": 0,
                    "linksWithTargetBlank": 0
                },
                Readability: "",
                Screenshots: {
                    "Mobile": "",
                    "Desktop": fileName,
                    "Navigation": ""
                },
                MobileFriendly: true,
                geminiAnalysis: aiParsedRes,
                aiRes,
            }

            const inserQ = `insert into report_results (report_id, project_id, result) values ('${reportId}', '${reportData.project_id}', '${JSON.stringify(reportResult)}') returning *`;
            const updateSatusQ = `update reports set status = 'completed' where id = '${reportId}'`;
            await db.execute(updateSatusQ);
            const reportResultDataRes = await db.execute(inserQ);
            if (reportResultDataRes.rows.length === 0) {
                console.log({ error: 'Failed to insert report result' }, reportResultDataRes);
            }

            console.log(`Job for reportId: ${reportId} completed successfully`);
        } catch (error) {
            console.error(`Error processing job for reportId: ${reportId}`, error);
        } finally {
            console.timeEnd("processQueue")

        }
    }

    isProcessing = false;
}

// Periodic processing (runs every 1 second)
setInterval(processQueue, 1000);

export function enqueueJob(job: { reportId: string; reportData: ReportData }) {
    jobQueue.push(job); // Enqueue a job
    console.log(`Job added to queue for reportId: ${job.reportId}`);
}
