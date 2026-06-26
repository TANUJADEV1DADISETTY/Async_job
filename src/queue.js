require('dotenv').config();
const { Worker } = require('bullmq');
const db = require('./db');
const os = require('os');

const workerId = `queue-${os.hostname()}-${process.pid}`;

console.log(`[Queue] Worker ${workerId} starting...`);

const worker = new Worker('jobs', async job => {
  const jobId = job.data.id;
  const startedAt = Date.now();
  console.log(`[Queue] Processing job ${jobId}, attempt ${job.attemptsMade + 1}`);

  await db.query(`UPDATE jobs SET status = 'ACTIVE', started_at = $1, worker_id = $2, attempts = $3 WHERE id = $4`, [startedAt, workerId, job.attemptsMade + 1, jobId]);

  // Simulate work 2-10s
  const sleepMs = Math.floor(Math.random() * (10000 - 2000 + 1) + 2000);
  await new Promise(res => setTimeout(res, sleepMs));

  // 20% failure simulation
  if (Math.random() < 0.2) {
    console.log(`[Queue] Job ${jobId} failed randomly!`);
    throw new Error('Random failure simulation');
  }

  const completedAt = Date.now();
  await db.query(`UPDATE jobs SET status = 'DONE', completed_at = $1 WHERE id = $2`, [completedAt, jobId]);
  console.log(`[Queue] Completed job ${jobId} in ${sleepMs}ms`);

}, {
  connection: { url: process.env.REDIS_URL },
  concurrency: 3
});

worker.on('failed', async (job, err) => {
  console.error(`[Queue] Job ${job.data.id} failed with error ${err.message}`);
  if (job.attemptsMade >= job.opts.attempts) {
      await db.query(`UPDATE jobs SET status = 'FAILED' WHERE id = $1`, [job.data.id]);
  } else {
      await db.query(`UPDATE jobs SET status = 'PENDING' WHERE id = $1`, [job.data.id]);
  }
});
