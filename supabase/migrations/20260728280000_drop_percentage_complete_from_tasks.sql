-- percentage_complete: no independent UI control ever wrote a custom value — every write site
-- just mirrors a fixed status->percent map (Assigned:0, In Progress:33, Review:66, Complete:100),
-- so the column carried no information beyond `status` itself.
alter table public.tasks drop column percentage_complete;
