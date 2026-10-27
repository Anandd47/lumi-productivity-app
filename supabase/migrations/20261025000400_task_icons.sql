-- Optional task icons are additive and nullable so existing records remain valid.
-- Writes still run as the authenticated caller and remain subject to task RLS.

alter table public.tasks
  add column if not exists icon text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'tasks_icon_length_check'
       and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_icon_length_check
      check (icon is null or char_length(icon) between 1 and 40);
  end if;
end;
$$;

-- Keep the existing four-argument RPC intact for older clients and iconless writes.
create or replace function public.save_lumi_task_with_icon(
  p_task_id uuid,
  p_title text,
  p_time text,
  p_local_date date,
  p_icon text
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
begin
  if p_icon is not null and char_length(p_icon) not between 1 and 40 then
    raise exception 'Invalid task icon' using errcode = '22023';
  end if;

  -- The established RPC validates the task, scopes writes to auth.uid(),
  -- updates timestamps, and repairs completion history if the date changes.
  v_task := public.save_lumi_task(p_task_id, p_title, p_time, p_local_date);

  update public.tasks
     set icon = p_icon
   where id = p_task_id
     and user_id = auth.uid()
   returning * into v_task;

  if not found then
    raise exception 'Task not found for this account' using errcode = 'P0002';
  end if;

  return v_task;
end;
$$;

revoke all on function public.save_lumi_task_with_icon(uuid, text, text, date, text) from public;
grant execute on function public.save_lumi_task_with_icon(uuid, text, text, date, text) to authenticated;

-- Refresh PostgREST's schema cache so the new column and RPC are visible promptly.
notify pgrst, 'reload schema';
