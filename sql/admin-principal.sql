-- ============================================================
-- Administrador principal (idempotente)
-- Nadie desde la web puede quitarle el rol, eliminarlo ni
-- nombrar a otro administrador principal.
-- Uso: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================

alter table public.perfiles add column if not exists es_principal boolean not null default false;

-- Solo puede haber UN administrador principal
create unique index if not exists perfiles_un_solo_principal
    on public.perfiles (es_principal) where es_principal;

-- Marca al administrador principal (cambia el correo si hace falta)
update public.perfiles set es_principal = true, rol = 'Administrador'
where email = 'saravcr20@gmail.com';

-- Bloquea cambios al principal desde la web (solo el SQL Editor/postgres puede)
create or replace function public.proteger_admin_principal()
returns trigger language plpgsql as $$
begin
    if current_user in ('postgres', 'supabase_admin') then
        return new;
    end if;
    if old.es_principal and (new.rol is distinct from old.rol or new.es_principal is distinct from old.es_principal) then
        raise exception 'El administrador principal no puede ser modificado';
    end if;
    if new.es_principal and not old.es_principal then
        raise exception 'Solo puede existir un administrador principal';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_proteger_admin_principal on public.perfiles;
create trigger trg_proteger_admin_principal before update on public.perfiles
    for each row execute procedure public.proteger_admin_principal();

-- Despido: ahora tampoco permite eliminar al administrador principal
create or replace function public.eliminar_empleado(p_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
    if not public.es_admin() then
        raise exception 'Solo el administrador puede eliminar empleados';
    end if;
    if p_id = auth.uid() then
        raise exception 'No puedes eliminar tu propia cuenta';
    end if;
    if exists (select 1 from public.perfiles where id = p_id and es_principal) then
        raise exception 'No se puede eliminar al administrador principal';
    end if;
    delete from auth.users where id = p_id;
end;
$$;

revoke all on function public.eliminar_empleado(uuid) from public, anon;
grant execute on function public.eliminar_empleado(uuid) to authenticated;
