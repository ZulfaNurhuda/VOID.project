-- Migration 007: Add full_name to users

ALTER TABLE users ADD COLUMN full_name VARCHAR(100);
