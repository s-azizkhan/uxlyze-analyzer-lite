import { serve } from '@hono/node-server'
import { Hono } from 'hono'
// load env
import { drizzle } from "drizzle-orm/node-postgres";
import type { ReportData } from './interfaces.ts';
import { DATABASE_URL, PORT } from './config.js';
import { mkdirSync } from 'fs';
import { enqueueJob } from './queue.js';

export const db = drizzle(DATABASE_URL);

const app = new Hono()

app.get('/version', (c) => {
  return c.json({ version: '1.0.0' })
})

app.get('/api/analyze/:id', async (c) => {
  const reportId = c.req.param('id')
  try {
    console.time("aiAnalyzeReport")
    // check is ID is vaid UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(reportId)) {
      return c.json({ error: 'Invalid report ID' }, 400);
    }
    // const response = await db.execute('SELECT * FROM reports WHERE id = $1', [reportId])
    const result = await db.execute(`select * from reports where id = '${reportId}'`);
    if (result.rows.length === 0) {
      return c.json({ error: 'Report not found' }, 404);
    }
    const reportData = result.rows[0] as unknown as ReportData;
    if (reportData.web_url === null || reportData.status !== 'pending') {
      return c.json({ error: 'Invalid report URL' }, 400);
    }

    // Enqueue the job
    enqueueJob({ reportId, reportData });

    // Respond immediately
    return c.json({ message: 'Analysis job has been queued', reportId }, 202);

  } catch (error) {
    console.log(error);
    return c.json({ error: 'An error occurred while retrieving data' }, 500);
  } finally {
    console.timeEnd("aiAnalyzeReport");
  }
});


async function runServer() {
  console.log(`Server is running on http://localhost:${PORT}/version`)
  //  create ss, and ai-response folder
  mkdirSync('./ss', { recursive: true });
  mkdirSync('./ai-response', { recursive: true });
  serve({
    fetch: app.fetch,
    port: PORT
  })
}

runServer()
