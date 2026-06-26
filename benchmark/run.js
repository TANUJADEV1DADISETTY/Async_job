require('dotenv').config();
const db = require('../src/db');
const fs = require('fs');

const API_URL = 'http://localhost:3000/api/export';

async function submitJobs(type, count) {
  console.log(`Submitting ${count} jobs to ${type} pathway...`);
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(
      fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, priority: 10, user_id: `bench-${i}` })
      }).then(res => res.json())
    );
  }
  const results = await Promise.all(promises);
  return results.map(r => r.job_id);
}

async function waitForCompletion(jobIds) {
  let done = false;
  while (!done) {
    const res = await db.query(`SELECT COUNT(*) FROM jobs WHERE id = ANY($1) AND status IN ('DONE', 'FAILED')`, [jobIds]);
    const count = parseInt(res.rows[0].count, 10);
    console.log(`Completed ${count}/${jobIds.length}...`);
    if (count === jobIds.length) {
      done = true;
    } else {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function calculateStats(jobIds, startTime, endTime) {
  const res = await db.query(`SELECT submitted_at, started_at FROM jobs WHERE id = ANY($1)`, [jobIds]);
  const latencies = res.rows.map(row => Number(row.started_at) - Number(row.submitted_at)).sort((a, b) => a - b);
  
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  
  const totalDurationMin = (endTime - startTime) / 60000;
  const throughput = jobIds.length / totalDurationMin;
  
  return {
    avg_latency_ms: parseFloat(avg.toFixed(2)),
    p95_latency_ms: parseFloat(p95.toFixed(2)),
    total_throughput_jobs_per_min: parseFloat(throughput.toFixed(2))
  };
}

async function run() {
  try {
    const cronIds = await submitJobs('CRON', 100);
    const cronStart = Date.now();
    await waitForCompletion(cronIds);
    const cronEnd = Date.now();
    const cronStats = await calculateStats(cronIds, cronStart, cronEnd);
    
    const queueIds = await submitJobs('QUEUE', 100);
    const queueStart = Date.now();
    await waitForCompletion(queueIds);
    const queueEnd = Date.now();
    const queueStats = await calculateStats(queueIds, queueStart, queueEnd);
    
    const results = {
      cron_stats: cronStats,
      queue_stats: queueStats
    };
    
    fs.mkdirSync('./output', { recursive: true });
    fs.writeFileSync('./output/benchmarking.json', JSON.stringify(results, null, 2));
    
    console.log('Benchmarking complete:', results);
    process.exit(0);
  } catch (err) {
    console.error('Benchmark failed:', err);
    process.exit(1);
  }
}

run();
