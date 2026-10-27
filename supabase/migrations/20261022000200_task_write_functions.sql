-- Atomic task writes for the authenticated user. These functions run as the
-- caller (not SECURITY DEFINER) and remain subject to the tasks/daily_logs RLS policies.

create or replace function public.lumi_task_sync_ready()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.uid() is not null;
$$;

create or replace function public.save_lumi_task(
  p_task_id uuid,
  p_title text,
  p_time text,
  p_local_date date
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_task public.tasks%rowtype;
  v_old_date date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_task_id is null or p_local_date is null
     or p_title is null or char_length(trim(p_title)) not between 1 and 80
     or p_time is null or p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Invalid task details' using errcode = '22023';
  end if;

  select * into v_task
    from public.tasks
    where id = p_task_id and user_id = v_user_id
    for update;

  if found then
    v_old_date := v_task.local_date;
    update public.tasks
      set title = trim(p_title), time = p_time, local_date = p_local_date, updated_at = now()
      where id = p_task_id and user_id = v_user_id
      returning * into v_task;

    if v_old_date <> p_local_date then
      update public.daily_logs
        set completed_task_ids = array_remove(completed_task_ids, p_task_id), updated_at = now()
        where user_id = v_user_id and local_date = v_old_date;
    end if;
  else
    insert into public.tasks (id, user_id, title, time, local_date)
      values (p_task_id, v_user_id, trim(p_title), p_time, p_local_date)
      returning * into v_task;
  end if;
  return v_task;
end;
$$;

create or replace function public.delete_lumi_task(p_task_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.tasks
    where id = p_task_id and user_id = v_user_id
    returning id into v_deleted_id;
  if v_deleted_id is null then
    raise exception 'Task not found for this account' using errcode = 'P0002';
  end if;

  update public.daily_logs
    set completed_task_ids = array_remove(completed_task_ids, p_task_id), updated_at = now()
    where user_id = v_user_id and p_task_id = any(completed_task_ids);
  return true;
end;
$$;

create or replace function public.set_lumi_task_completion(
  p_task_id uuid,
  p_local_date date,
  p_completed boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.tasks
    where id = p_task_id and user_id = v_user_id and local_date = p_local_date
  ) then
    raise exception 'Task not found for this account and date' using errcode = 'P0002';
  end if;

  if p_completed then
    insert into public.daily_logs as current_log (user_id, local_date, completed_task_ids)
      values (v_user_id, p_local_date, array[p_task_id]::uuid[])
      on conflict (user_id, local_date) do update
        set completed_task_ids = (
          select coalesce(array_agg(distinct item.task_id), '{}'::uuid[])
          from unnest(current_log.completed_task_ids || excluded.completed_task_ids) as item(task_id)
        ), updated_at = now();
  else
    update public.daily_logs
      set completed_task_ids = array_remove(completed_task_ids, p_task_id), updated_at = now()
      where user_id = v_user_id and local_date = p_local_date;
  end if;
end;
$$;

revoke all on function public.save_lumi_task(uuid, text, text, date) from public;
revoke all on function public.delete_lumi_task(uuid) from public;
revoke all on function public.set_lumi_task_completion(uuid, date, boolean) from public;
revoke all on function public.lumi_task_sync_ready() from public;
grant execute on function public.save_lumi_task(uuid, text, text, date) to authenticated;
grant execute on function public.delete_lumi_task(uuid) to authenticated;
grant execute on function public.set_lumi_task_completion(uuid, date, boolean) to authenticated;
grant execute on function public.lumi_task_sync_ready() to authenticated;
