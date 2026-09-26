-- Second rate-limited endpoint: guest order lookup (order number + phone). One limiter for both,
-- with a scope per endpoint so lookups never use up order attempts. Limits move to the caller.
-- Buckets: '<scope>:ip:203.0.113.7', '<scope>:ip:2001:db8:1:2::/64', '<scope>:phone:0901234567'.
drop function public.hit_order_rate_limit(text, text);

-- Counts one attempt for the IP and the phone in the current 1-hour window; true = allowed.
-- IPv4-mapped IPv6 is unwrapped, other IPv6 bucketed per /64. Unparsable / NULL IP or phone →
-- that limit is skipped.
create function public.hit_rate_limit(p_scope text, p_ip text, p_phone text, p_ip_limit int, p_phone_limit int)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_window     timestamptz := date_bin('1 hour', now(), timestamptz 'epoch');
  v_phone      text := public.normalize_vn_phone(p_phone);
  v_inet       inet;
  v_ip_hits    int := 0;
  v_phone_hits int := 0;
begin
  if p_scope !~ '^[a-z]+$' then
    raise exception 'INVALID_SCOPE';
  end if;

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
    values (p_scope || ':ip:' || case when family(v_inet) = 6 then network(set_masklen(v_inet, 64))::text else host(v_inet) end, v_window)
    on conflict (bucket, window_start) do update set hits = r.hits + 1
    returning hits into v_ip_hits;
  end if;

  if v_phone is not null then
    insert into rate_limits as r (bucket, window_start)
    values (p_scope || ':phone:' || v_phone, v_window)
    on conflict (bucket, window_start) do update set hits = r.hits + 1
    returning hits into v_phone_hits;
  end if;

  return v_ip_hits <= p_ip_limit and v_phone_hits <= p_phone_limit;
end $$;

revoke execute on function public.hit_rate_limit(text, text, text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, text, text, int, int) to service_role;
