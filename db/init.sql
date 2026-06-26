CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY,
    type VARCHAR NOT NULL,
    priority INT DEFAULT 10,
    status VARCHAR NOT NULL,
    submitted_at BIGINT NOT NULL,
    started_at BIGINT,
    completed_at BIGINT,
    worker_id VARCHAR,
    attempts INT DEFAULT 0
);
