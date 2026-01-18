-- Creates the hipocap database used by hipocap_server (connection.py defaults to DB_NAME=hipocap_second).
-- This runs only on FIRST container init (when the Postgres data dir is empty).
SELECT 'CREATE DATABASE hipocap_second'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'hipocap_second'
)\gexec





