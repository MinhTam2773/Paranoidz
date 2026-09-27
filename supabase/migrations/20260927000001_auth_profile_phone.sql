-- ============================================================
-- Auth: phone required + unique per account (ARCHITECTURE.md §1).
-- profiles.phone is stored normalized, like orders.phone, so '090 123 4567' and
-- '+84901234567' can't be two accounts. It can't be NOT NULL: OAuth signups
-- (Google/Facebook) carry no phone, so the storefront asks for it after login.
-- ============================================================

alter table public.profiles
  add constraint profiles_phone_normalized check (phone = public.normalize_vn_phone(phone));

-- Signup copies name + phone from user metadata (email signup sends both; OAuth sends a
-- name as full_name or name). A phone that is invalid or already on another account is
-- dropped instead of failing the signup — the storefront's phone step then asks again
-- and says why. The exception block also covers two signups racing for one phone.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_name  text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
  v_phone text := public.normalize_vn_phone(new.raw_user_meta_data ->> 'phone');
begin
  begin
    insert into public.profiles (id, full_name, phone) values (new.id, v_name, v_phone);
  exception when unique_violation then
    insert into public.profiles (id, full_name) values (new.id, v_name);
  end;
  return new;
end $$;
