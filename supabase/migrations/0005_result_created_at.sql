-- Several results can share a recorded_on date; created_at gives a stable "latest".
alter table assessment_results add column created_at timestamptz not null default now();
create index on assessment_results (athlete_id, type_id, recorded_on desc, created_at desc);
