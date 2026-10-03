-- Lets the app keep username-based login while Supabase Auth still uses email internally.

create or replace function public.resolve_login_identifier(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_identifier text := lower(trim(coalesce(p_identifier, '')));
  v_email text;
begin
  if v_identifier = '' then
    raise exception 'Informe o usuario.';
  end if;

  if position('@' in v_identifier) > 0 then
    return v_identifier;
  end if;

  select au.email
  into v_email
  from public.profiles p
  join auth.users au on au.id = p.id
  where lower(coalesce(p.username, '')) = v_identifier
    and p.is_active = true
  limit 1;

  if v_email is null then
    v_email := v_identifier || '@clientes.teffexclusivo.app';
  end if;

  return v_email;
end;
$$;

grant execute on function public.resolve_login_identifier(text) to anon;
grant execute on function public.resolve_login_identifier(text) to authenticated;
