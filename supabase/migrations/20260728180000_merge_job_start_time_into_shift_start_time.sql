-- job_start_time (one-off jobs) and shift_start_time (shift jobs) are mutually exclusive at
-- every write site and never read together anywhere in the app — job_type alone always
-- disambiguates which one is "the start time" for a given posting (verified: 0 rows ever had
-- both set, 0 rows had the wrong-type field populated). Collapse into shift_start_time; job_type
-- still decides whether it's paired with shift_end_time (shift) or used alone (one-off).
update public.job_postings set shift_start_time = job_start_time where job_start_time is not null;
alter table public.job_postings drop column job_start_time;
