# Async Job Performance Lab: Cron Polling vs Distributed Redis Queue Workers

## Overview

The **Async Job Performance Lab** is a distributed backend application that compares two asynchronous job processing strategies:

- **Cron Polling**
- **Redis-backed Queue Workers (BullMQ)**

The objective is to benchmark both approaches by measuring:

- Job discovery latency
- Job execution latency
- Throughput
- Reliability
- Worker crash recovery
- Priority scheduling
- Retry mechanisms

The system exposes a REST API for submitting export jobs, processes them using either PostgreSQL polling or Redis queues, and generates benchmarking reports.

---

# Features

## Cron Processing

- Configurable polling interval
- Sequential processing
- PostgreSQL Advisory Locks
- Duplicate execution prevention
- PostgreSQL job tracking

## Queue Processing

- BullMQ Queue
- Redis backend
- Distributed workers
- Concurrent processing
- Automatic retries
- Exponential backoff
- Priority scheduling
- Worker crash recovery

## Benchmarking

- Submit 100 Cron jobs
- Submit 100 Queue jobs
- Measure average latency
- Measure P95 latency
- Calculate throughput
- Export benchmark report

---

# Technology Stack

## Backend

- Node.js
- Express.js

## Database

- PostgreSQL

## Queue

- Redis
- BullMQ

## ORM

- Prisma

## Dashboard

- BullBoard

## Containerization

- Docker
- Docker Compose

---

# Project Structure

```
async-job-performance-lab/

├── api/
│   ├── server.js
│   ├── routes.js
│   ├── controller.js
│   └── db.js
│
├── cron/
│   └── cronWorker.js
│
├── queue/
│   ├── queue.js
│   ├── worker.js
│   └── bullBoard.js
│
├── benchmark/
│   └── benchmark.js
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── output/
│   └── benchmarking.json
│
├── docker-compose.yml
├── Dockerfile
├── submission.json
├── .env.example
└── README.md
```

---

# Architecture

```
                 +---------------------+
                 |   Benchmark Client  |
                 +----------+----------+
                            |
                            |
                    POST /api/export
                            |
                +-----------v-----------+
                |      Express API      |
                +-----------+-----------+
                            |
             +--------------+--------------+
             |                             |
             |                             |
        CRON PATHWAY                 QUEUE PATHWAY
             |                             |
      PostgreSQL Jobs                BullMQ Queue
             |                             |
       Cron Worker                    Redis Server
             |                             |
             |                     Queue Worker 1
             |                     Queue Worker 2
             |                     Queue Worker N
             +-------------+---------------+
                           |
                     PostgreSQL
```

---

# Database Schema

## jobs

| Column       | Type    | Description                   |
| ------------ | ------- | ----------------------------- |
| id           | UUID    | Primary Key                   |
| type         | VARCHAR | CRON or QUEUE                 |
| priority     | INT     | 1 (Highest) to 10 (Lowest)    |
| status       | VARCHAR | PENDING, ACTIVE, DONE, FAILED |
| submitted_at | BIGINT  | Submission Timestamp          |
| started_at   | BIGINT  | Processing Start              |
| completed_at | BIGINT  | Completion Timestamp          |
| worker_id    | VARCHAR | Worker Name                   |
| attempts     | INT     | Retry Count                   |

---

## execution_logs

| Column    | Description       |
| --------- | ----------------- |
| id        | Primary Key       |
| job_id    | UUID              |
| worker_id | Worker Identifier |
| timestamp | Execution Time    |

---

# Job Lifecycle

```
PENDING
   │
   ▼
ACTIVE
   │
   ▼
DONE
```

If processing fails:

```
PENDING
   │
   ▼
ACTIVE
   │
   ▼
FAILED
   │
   ▼
Retry
   │
   ▼
ACTIVE
   │
   ▼
DONE
```

---

# API Documentation

## Submit Export Job

### Endpoint

```
POST /api/export
```

### Request

```json
{
  "type": "QUEUE",
  "priority": 1,
  "user_id": "user123"
}
```

### Response

```json
{
  "job_id": "UUID",
  "status": "PENDING",
  "type": "QUEUE"
}
```

---

# Cron Processing

The Cron worker executes at a configurable interval.

Default:

```
CRON_INTERVAL_MS=10000
```

Workflow:

```
Poll Database
      │
      ▼
Fetch Pending Jobs
      │
      ▼
Acquire Advisory Lock
      │
      ▼
Process Sequentially
      │
      ▼
Update Database
      │
      ▼
Release Lock
```

---

# Queue Processing

BullMQ workers continuously listen for new jobs.

Workflow:

```
Receive Job
      │
      ▼
Update started_at
      │
      ▼
Sleep 2–10 Seconds
      │
      ▼
Update completed_at
      │
      ▼
DONE
```

---

# Priority Scheduling

Priority values

```
1  -> Highest Priority

10 -> Lowest Priority
```

BullMQ always executes lower numeric priorities before higher numeric priorities.

---

# Retry Policy

Random failure simulation:

- 20% failure probability

Maximum retries:

```
3
```

Retry schedule

```
Attempt 1

↓

5 seconds

↓

Attempt 2

↓

10 seconds

↓

Attempt 3

↓

20 seconds
```

After maximum retries:

```
FAILED
```

---

# PostgreSQL Advisory Locks

Each Cron worker attempts to acquire an advisory lock before processing a job.

Workflow

```
Fetch Pending Job
        │
        ▼
pg_try_advisory_lock()
        │
        ├───────────────┐
        │               │
     TRUE            FALSE
        │               │
        ▼               ▼
Process Job        Skip Job
        │
        ▼
Release Lock
```

This guarantees that no two Cron workers process the same job simultaneously.

---

# Benchmarking

Run

```bash
node benchmark/benchmark.js
```

The benchmarking script performs:

1. Submit 100 Cron jobs.
2. Wait for completion.
3. Measure latency.
4. Submit 100 Queue jobs.
5. Wait for completion.
6. Measure latency.
7. Generate benchmarking report.

---

# Benchmark Output

Location

```
output/benchmarking.json
```

Example

```json
{
  "cron_stats": {
    "avg_latency_ms": 10125.4,
    "p95_latency_ms": 10890.2,
    "total_throughput_jobs_per_min": 45.2
  },
  "queue_stats": {
    "avg_latency_ms": 37.6,
    "p95_latency_ms": 71.8,
    "total_throughput_jobs_per_min": 241.9
  }
}
```

---

# Running the Project

## Clone Repository

```bash
git clone https://github.com/yourusername/async-job-performance-lab.git

cd async-job-performance-lab
```

## Configure Environment

Copy

```
.env.example
```

to

```
.env
```

Fill in the required environment variables.

---

## Start Services

```bash
docker-compose up -d
```

---

## Verify Containers

```bash
docker-compose ps
```

Expected services:

- api
- postgres
- redis
- cron-worker
- queue-worker-1
- queue-worker-2

---

# BullBoard Dashboard

Open

```
http://localhost:3000/admin/queues
```

The dashboard displays:

- Waiting Jobs
- Active Jobs
- Completed Jobs
- Failed Jobs
- Delayed Jobs
- Retry Counts

---

# Health Checks

PostgreSQL

```bash
pg_isready
```

Redis

```bash
redis-cli ping
```

Expected output

```
PONG
```

---

# Worker Crash Recovery

Stop a worker

```bash
docker-compose stop queue-worker-1
```

BullMQ automatically:

- Detects stalled jobs
- Moves them back to waiting
- Reassigns them to another worker
- Continues processing

Cron workers do not automatically recover interrupted jobs.

---

# Environment Variables

```
DATABASE_URL=

REDIS_URL=

PORT=3000

CRON_INTERVAL_MS=10000

USE_ADVISORY_LOCK=true
```

---

# submission.json

```json
{
  "api_port": 3000,
  "test_job_types": ["CRON", "QUEUE"],
  "db_connection": "DATABASE_URL",
  "redis_connection": "REDIS_URL"
}
```

---

# Verification Checklist

- REST API returns HTTP 201.
- Jobs are stored in PostgreSQL.
- Cron worker polls correctly.
- Queue worker starts processing immediately.
- Priority scheduling works.
- Retry mechanism functions correctly.
- Advisory locks prevent duplicate execution.
- Benchmark report is generated.
- BullBoard displays live metrics.
- Docker health checks pass.

---

# Performance Analysis

## Cron Polling

### Advantages

- Simple implementation
- Minimal infrastructure
- Suitable for maintenance tasks

### Limitations

- Polling delay
- Sequential execution
- Lower throughput
- Manual retry logic
- Explicit locking required

---

## Queue Workers

### Advantages

- Near-zero discovery latency
- Concurrent processing
- Automatic retries
- Priority scheduling
- Horizontal scalability
- Worker crash recovery

---

# Conclusion

The benchmarking results demonstrate that **BullMQ Queue Workers significantly outperform Cron Polling** for user-facing asynchronous workloads.

Queue workers begin processing jobs almost immediately after submission, support concurrent execution, automatically retry failed jobs with exponential backoff, and recover gracefully from worker failures. In contrast, Cron-based processing introduces unavoidable polling latency and processes jobs sequentially, making it better suited for scheduled maintenance tasks rather than real-time asynchronous processing.

---

# Future Improvements

- Kubernetes deployment
- Horizontal auto-scaling
- Prometheus monitoring
- Grafana dashboards
- OpenTelemetry tracing
- Dead Letter Queue (DLQ)
- Authentication
- Job cancellation
- WebSocket progress updates
- Rate limiting

---

# License

This project was developed for educational purposes as part of the **Async Job Performance Lab** assignment.
