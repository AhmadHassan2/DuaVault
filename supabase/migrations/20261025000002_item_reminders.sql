-- Daily reminder time per saved item (e.g. morning adhkar at 07:00), local time.
alter table public.saved_items add column reminder_time time;
