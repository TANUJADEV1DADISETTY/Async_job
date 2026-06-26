require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const db = require('./db');
const { Queue } = require('bullmq');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const jobQueue = new Queue('jobs', {
  connection: {
    url: process.env.REDIS_URL
  }
});

app.post('/api/benchmark', (req, res) => {
  exec('npm run start:benchmark', { cwd: path.join(__dirname, '../') }, (error, stdout, stderr) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Benchmark failed' });
    }
    try {
      const results = require('../output/benchmarking.json');
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: 'Failed to read results' });
    }
  });
});

app.post('/api/export', async (req, res) => {
  const { type, priority = 10, user_id } = req.body;
  if (type !== 'CRON' && type !== 'QUEUE') {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const id = crypto.randomUUID();
  const submittedAt = Date.now();

  try {
    await db.query(
      `INSERT INTO jobs (id, type, priority, status, submitted_at) VALUES ($1, $2, $3, $4, $5)`,
      [id, type, priority, 'PENDING', submittedAt]
    );

    if (type === 'QUEUE') {
      await jobQueue.add('exportJob', { id, user_id }, { priority, attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
    }

    res.status(201).json({
      job_id: id,
      status: 'PENDING',
      type
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
