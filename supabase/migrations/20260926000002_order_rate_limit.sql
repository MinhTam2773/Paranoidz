-- ============================================================
-- Order rate limit per IP + phone (ARCHITECTURE.md §6).
-- place_order()'s own caps (20 units, 3 pending per phone) stop one phone; this stops a
-- client rotating fake phones from one IP, and slows voucher-code guessing.
-- Called by the order route BEFORE place_order(), as its own statement: a limit raised inside
-- place_order() would roll back its own counter along with the order.
-- ============================================================

-- Fixed 1-hour windows. Buckets: 'ip:203.0.113.7', 'ip:2001:db8:1:2::/64', 'phone:0901234567'.
create table public.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         int not null default 1,
  primary key (bucket, window_start)
);

-- No client access at all (deny-by-default): service role only.
alter table public.rate_limits enable row level security;

-- Counts one order attempt for the IP and the phone; true = allowed.
-- Every attempt counts, including ones place_order() later rejects.
-- IPv6 is bucketed per /64 (one subscriber's block). Unparsable / NULL IP → phone limit only.
create function public.hit_order_rate_limit(p_ip text, p_phone text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  c_ip_limit    constant int := 10;
  c_phone_limit constant int := 5;
  v_window      timestamptz := date_bin('1 hour', now(), timestamptz 'epoch');
  v_phone       text := public.normalize_vn_phone(p_phone);
  v_inet        inet;
  v_ip_hits     int := 0;
  v_phone_hits  int := 0;
begin
  begin
    v_inet := p_ip::inet;
  exception when others then
    v_inet := null;
  end;

  -- Old windows are useless; the table stays a few hours of rows.
  delete from rate_limits where window_start < v_window - interval '1 hour';

  if v_inet is not null then
    insert into rate_limits as r (bucket, window_start)
    values ('ip:' || case when family(v_inet) = 6 then network(set_masklen(v_inet, 64))::text else host(v_inet) end, v_window)
    on conflict (bucket, window_start) do update set hits = r.hits + 1
    returning hits into v_ip_hits;
  end if;

  if v_phone is not null then
    insert into rate_limits as r (bucket, window_start)
    values ('phone:' || v_phone, v_window)
    on conflict (bucket, window_start) do update set hits = r.hits + 1
    returning hits into v_phone_hits;
  end if;

  return v_ip_hits <= c_ip_limit and v_phone_hits <= c_phone_limit;
end $$;

revoke execute on function public.hit_order_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.hit_order_rate_limit(text, text) to service_role;
