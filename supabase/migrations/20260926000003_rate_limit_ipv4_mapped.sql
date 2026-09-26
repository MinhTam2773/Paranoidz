-- hit_order_rate_limit(): an IPv4-mapped IPv6 address ('::ffff:203.0.113.7', what a dual-stack
-- Node socket reports off Vercel) was bucketed per /64 = '::/64', i.e. every IPv4 client in one
-- shared bucket. Unwrap it to the plain IPv4 address first.
create or replace function public.hit_order_rate_limit(p_ip text, p_phone text)
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
    if v_inet << inet '::ffff:0:0/96' then
      v_inet := substring(host(v_inet) from '^::ffff:([0-9.]+)$')::inet;
    end if;
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
