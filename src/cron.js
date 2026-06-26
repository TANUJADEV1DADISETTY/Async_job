require('dotenv').config();
const db = require('./db');
const os = require('os');

const INTERVAL = parseInt(process.env.CRON_INTERVAL_MS) || 10000;
const workerId = `cron-${os.hostname()}-${process.pid}`;

async function processJob(job) {
  const startedAt = Date.now();
  console.log(`[Cron] Processing job ${job.id}`);
  
  await db.query(`UPDATE jobs SET status = 'ACTIVE', started_at = $1, worker_id = $2 WHERE id = $3`, [startedAt, workerId, job.id]);

  // Simulate work 2-10s
  const sleepMs = Math.floor(Math.random() * (10000 - 2000 + 1) + 2000);
  await new Promise(res => setTimeout(res, sleepMs));

  const completedAt = Date.now();
  await db.query(`UPDATE jobs SET status = 'DONE', completed_at = $1 WHERE id = $2`, [completedAt, job.id]);
  console.log(`[Cron] Completed job ${job.id} in ${sleepMs}ms`);
}

async function runCron() {
  console.log(`[Cron] Worker ${workerId} polling every ${INTERVAL}ms...`);
  setInterval(async () => {
    try {
      // Fetch all PENDING CRON jobs
      const res = await db.query(`SELECT id FROM jobs WHERE type = 'CRON' AND status = 'PENDING' ORDER BY priority ASC, submitted_at ASC`);
      for (const row of res.rows) {
        const jobId = row.id;
        // Postgres UUIDs are 128-bit, pg_try_advisory_lock takes a 64-bit int.
        // We can use hashtext(id::text) for a 32-bit int lock
        const lockRes = await db.query(`SELECT pg_try_advisory_lock(hashtext($1)) as locked`, [jobId]);
        if (lockRes.rows[0].locked) {
          try {
             // double check status in case another worker picked it up before we got the lock
             const doubleCheck = await db.query(`SELECT status FROM jobs WHERE id = $1`, [jobId]);
             if (doubleCheck.rows[0].status === 'PENDING') {
                await processJob({ id: jobId });
             }
          } finally {
             await db.query(`SELECT pg_advisory_unlock(hashtext($1))`, [jobId]);
          }
        }
      }
    } catch (e) {
      console.error(`[Cron] Error`, e);
    }
  }, INTERVAL);
}

runCron();
