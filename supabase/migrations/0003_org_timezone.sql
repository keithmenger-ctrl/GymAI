-- "Today" is defined in the facility's local time.
alter table organizations add column timezone text not null default 'America/Los_Angeles';
