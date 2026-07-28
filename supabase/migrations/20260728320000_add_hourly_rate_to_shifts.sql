-- Pay rate now lives on the job/shift, not on the worker (users.hourly_rate dropped in a
-- companion migration). Set from job_postings.salary_amount at shift-creation time for
-- Casual-Worker-sourced shifts; null for internal-staff shifts (Employees are salaried, not paid
-- per shift).
alter table public.shifts add column hourly_rate numeric(10, 2);
