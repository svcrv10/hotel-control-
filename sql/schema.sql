-- ============================================================
-- HotelControl v2 - Esquema completo para Supabase (PostgreSQL)
-- ============================================================
-- Es IDEMPOTENTE: sirve tanto para un proyecto nuevo como para
-- actualizar el que ya tenías con la versión 1. No borra datos.
-- Uso: Supabase > SQL Editor > New query > pegar todo > Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1) PERFILES (empleados)
-- ------------------------------------------------------------
create table if not exists public.perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null,
    rol text not null default 'En espera'
);

alter table public.perfiles add column if not exists nombre text;
alter table public.perfiles add column if not exists apellido text;
alter table public.perfiles add column if not exists cedula text;
alter table public.perfiles add column if not exists telefono text;
alter table public.perfiles add column if not exists fecha_nacimiento date;
alter table public.perfiles add column if not exists email text;
alter table public.perfiles add column if not exists created_at timestamptz not null default now();
alter table public.perfiles alter column rol set default 'En espera';

create unique index if not exists perfiles_cedula_unico on public.perfiles (cedula) where cedula is not null;

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
    check (rol in ('En espera', 'Recepcionista', 'Administrador'));

-- Completa el correo de perfiles ya existentes (por ejemplo el admin de la v1)
update public.perfiles p set email = u.email
from auth.users u where u.id = p.id and p.email is null;

-- ------------------------------------------------------------
-- 2) Funciones auxiliares de rol
-- ------------------------------------------------------------
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
    select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
    select coalesce((select rol = 'Administrador' from public.perfiles where id = auth.uid()), false)
$$;

create or replace function public.es_personal()
returns boolean language sql stable security definer set search_path = public as $$
    select coalesce((select rol in ('Administrador', 'Recepcionista') from public.perfiles where id = auth.uid()), false)
$$;

-- ------------------------------------------------------------
-- 3) Trigger de registro: crea el perfil SIEMPRE "En espera"
--    (el rol nunca se toma de lo que envíe el navegador)
-- ------------------------------------------------------------
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
    v_nombre text := nullif(trim(new.raw_user_meta_data->>'nombre'), '');
    v_apellido text := nullif(trim(new.raw_user_meta_data->>'apellido'), '');
begin
    insert into public.perfiles (id, username, rol, nombre, apellido, cedula, telefono, fecha_nacimiento, email)
    values (
        new.id,
        coalesce(trim(concat_ws(' ', v_nombre, v_apellido)), split_part(new.email, '@', 1)),
        'En espera',
        v_nombre,
        v_apellido,
        nullif(trim(new.raw_user_meta_data->>'cedula'), ''),
        nullif(trim(new.raw_user_meta_data->>'telefono'), ''),
        nullif(new.raw_user_meta_data->>'fecha_nacimiento', '')::date,
        new.email
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.crear_perfil_nuevo_usuario();

-- ------------------------------------------------------------
-- 4) Tablas del hotel (ya existían en v1) + columnas nuevas
-- ------------------------------------------------------------
create table if not exists public.habitaciones (
    id bigint generated always as identity primary key,
    numero text unique not null,
    tipo text not null,
    precio_noche numeric(10, 2) not null,
    estado text not null default 'Disponible'
        check (estado in ('Disponible', 'Ocupada', 'Mantenimiento'))
);

create table if not exists public.huespedes (
    id bigint generated always as identity primary key,
    cedula_pasaporte text unique not null,
    nombre_completo text not null,
    telefono text,
    email text
);

create table if not exists public.reservaciones (
    id bigint generated always as identity primary key,
    huesped_id bigint not null references public.huespedes(id),
    habitacion_id bigint not null references public.habitaciones(id),
    fecha_entrada date not null,
    fecha_salida date not null,
    monto_total numeric(10, 2) not null,
    estado text not null default 'Confirmada'
        check (estado in ('Confirmada', 'Check-In', 'Check-Out', 'Cancelada'))
);

alter table public.reservaciones add column if not exists estado_pago text not null default 'Pendiente';
alter table public.reservaciones drop constraint if exists reservaciones_estado_pago_check;
alter table public.reservaciones add constraint reservaciones_estado_pago_check
    check (estado_pago in ('Pendiente', 'Pagada'));
alter table public.reservaciones add column if not exists creado_por uuid references public.perfiles(id) on delete set null default auth.uid();
alter table public.reservaciones add column if not exists created_at timestamptz not null default now();

-- ------------------------------------------------------------
-- 5) Cierres de caja, pagos, facturas, movimientos
-- ------------------------------------------------------------
create table if not exists public.cierres_caja (
    id bigint generated always as identity primary key,
    fecha date not null,
    total numeric(10, 2) not null,
    cantidad_pagos integer not null,
    detalle jsonb not null default '[]'::jsonb,
    cerrado_por uuid references public.perfiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.pagos (
    id bigint generated always as identity primary key,
    reservacion_id bigint not null references public.reservaciones(id),
    metodo text not null
        check (metodo in ('Efectivo', 'Tarjeta', 'Transferencia', 'Pago móvil', 'Zelle')),
    monto numeric(10, 2) not null,
    referencia text,
    fecha_pago timestamptz not null default now(),
    usuario_id uuid references public.perfiles(id) on delete set null default auth.uid(),
    cierre_id bigint references public.cierres_caja(id)
);

create table if not exists public.facturas (
    id bigint generated always as identity primary key,
    reservacion_id bigint not null references public.reservaciones(id),
    huesped_id bigint not null references public.huespedes(id),
    pago_id bigint not null references public.pagos(id),
    total numeric(10, 2) not null,
    fecha timestamptz not null default now(),
    emitida_por uuid references public.perfiles(id) on delete set null default auth.uid()
);

create table if not exists public.movimientos_reserva (
    id bigint generated always as identity primary key,
    reservacion_id bigint not null references public.reservaciones(id) on delete cascade,
    accion text not null,
    detalle text,
    usuario_id uuid references public.perfiles(id) on delete set null default auth.uid(),
    fecha timestamptz not null default now()
);

-- Registro automático de movimientos de reservaciones
create or replace function public.log_movimiento_reserva()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if tg_op = 'INSERT' then
        insert into public.movimientos_reserva (reservacion_id, accion, detalle)
        values (new.id, 'Reservación creada', 'Monto total: $' || new.monto_total);
    else
        if new.estado is distinct from old.estado then
            insert into public.movimientos_reserva (reservacion_id, accion, detalle)
            values (new.id, new.estado, old.estado || ' → ' || new.estado);
        end if;
        if new.estado_pago is distinct from old.estado_pago then
            insert into public.movimientos_reserva (reservacion_id, accion, detalle)
            values (new.id, case when new.estado_pago = 'Pagada' then 'Pago registrado' else 'Pago pendiente' end, 'Total: $' || new.monto_total);
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_log_reservacion on public.reservaciones;
create trigger trg_log_reservacion
    after insert or update on public.reservaciones
    for each row execute procedure public.log_movimiento_reserva();

-- ------------------------------------------------------------
-- 6) Funciones de negocio (atómicas y validadas en el servidor)
-- ------------------------------------------------------------

-- Cobra una reservación y emite su factura. Devuelve el id de la factura.
create or replace function public.procesar_pago(
    p_reservacion bigint, p_metodo text, p_referencia text default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
    r public.reservaciones%rowtype;
    v_pago bigint;
    v_factura bigint;
begin
    if not public.es_personal() then
        raise exception 'No tienes permiso para procesar pagos';
    end if;
    select * into r from public.reservaciones where id = p_reservacion for update;
    if not found then raise exception 'La reservación no existe'; end if;
    if r.estado = 'Cancelada' then raise exception 'No se puede cobrar una reservación cancelada'; end if;
    if r.estado_pago = 'Pagada' then raise exception 'Esta reservación ya fue pagada'; end if;
    if p_metodo <> 'Efectivo' and coalesce(trim(p_referencia), '') = '' then
        raise exception 'Este método de pago requiere un número de referencia';
    end if;

    insert into public.pagos (reservacion_id, metodo, monto, referencia)
    values (r.id, p_metodo, r.monto_total, nullif(trim(p_referencia), ''))
    returning id into v_pago;

    insert into public.facturas (reservacion_id, huesped_id, pago_id, total)
    values (r.id, r.huesped_id, v_pago, r.monto_total)
    returning id into v_factura;

    update public.reservaciones set estado_pago = 'Pagada' where id = r.id;
    return v_factura;
end;
$$;

-- Cierre de caja del día: agrupa por método los pagos aún no cerrados.
create or replace function public.cerrar_caja(p_fecha date)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
    v_total numeric(10, 2);
    v_cant integer;
    v_detalle jsonb;
    v_id bigint;
begin
    if not public.es_admin() then
        raise exception 'Solo el administrador puede realizar el cierre de caja';
    end if;

    select coalesce(sum(monto), 0), count(*) into v_total, v_cant
    from public.pagos
    where cierre_id is null and (fecha_pago at time zone 'America/Caracas')::date = p_fecha;

    if v_cant = 0 then raise exception 'No hay pagos pendientes de cierre para esa fecha'; end if;

    select jsonb_agg(jsonb_build_object('metodo', metodo, 'cantidad', cant, 'total', tot) order by metodo)
    into v_detalle
    from (
        select metodo, count(*) as cant, sum(monto) as tot
        from public.pagos
        where cierre_id is null and (fecha_pago at time zone 'America/Caracas')::date = p_fecha
        group by metodo
    ) x;

    insert into public.cierres_caja (fecha, total, cantidad_pagos, detalle, cerrado_por)
    values (p_fecha, v_total, v_cant, v_detalle, auth.uid())
    returning id into v_id;

    update public.pagos set cierre_id = v_id
    where cierre_id is null and (fecha_pago at time zone 'America/Caracas')::date = p_fecha;

    return v_id;
end;
$$;

-- Despido: borra al empleado de Supabase Auth y de perfiles.
-- (Pagos y facturas se conservan por contabilidad, sin nombre de usuario.)
-- Al quedar libre su correo y su cédula, puede registrarse de nuevo y
-- volverá a quedar "En espera" hasta que un administrador le asigne rol.
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
    delete from auth.users where id = p_id;   -- perfiles se borra en cascada
end;
$$;

revoke all on function public.procesar_pago(bigint, text, text) from public, anon;
revoke all on function public.cerrar_caja(date) from public, anon;
revoke all on function public.eliminar_empleado(uuid) from public, anon;
grant execute on function public.procesar_pago(bigint, text, text) to authenticated;
grant execute on function public.cerrar_caja(date) to authenticated;
grant execute on function public.eliminar_empleado(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7) Seguridad por filas (RLS) según el rol
-- ------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.habitaciones enable row level security;
alter table public.huespedes enable row level security;
alter table public.reservaciones enable row level security;
alter table public.pagos enable row level security;
alter table public.facturas enable row level security;
alter table public.cierres_caja enable row level security;
alter table public.movimientos_reserva enable row level security;

-- Limpia políticas de la v1 y de re-ejecuciones
drop policy if exists "Perfiles: usuarios autenticados pueden leer" on public.perfiles;
drop policy if exists "Perfiles: un usuario edita su propio perfil" on public.perfiles;
drop policy if exists "Habitaciones: acceso total a autenticados" on public.habitaciones;
drop policy if exists "Huespedes: acceso total a autenticados" on public.huespedes;
drop policy if exists "Reservaciones: acceso total a autenticados" on public.reservaciones;
drop policy if exists "perfiles_select" on public.perfiles;
drop policy if exists "perfiles_update_admin" on public.perfiles;
drop policy if exists "habitaciones_personal" on public.habitaciones;
drop policy if exists "huespedes_personal" on public.huespedes;
drop policy if exists "reservaciones_select" on public.reservaciones;
drop policy if exists "reservaciones_insert" on public.reservaciones;
drop policy if exists "reservaciones_update" on public.reservaciones;
drop policy if exists "pagos_select" on public.pagos;
drop policy if exists "facturas_select" on public.facturas;
drop policy if exists "cierres_select" on public.cierres_caja;
drop policy if exists "movimientos_select" on public.movimientos_reserva;

-- Perfiles: cada quien ve el suyo; el admin ve y edita todos
create policy "perfiles_select" on public.perfiles for select to authenticated
    using (id = auth.uid() or public.es_admin());
create policy "perfiles_update_admin" on public.perfiles for update to authenticated
    using (public.es_admin()) with check (public.es_admin());

-- Habitaciones, huéspedes y reservaciones: Administrador y Recepcionista
create policy "habitaciones_personal" on public.habitaciones for all to authenticated
    using (public.es_personal()) with check (public.es_personal());
create policy "huespedes_personal" on public.huespedes for all to authenticated
    using (public.es_personal()) with check (public.es_personal());
create policy "reservaciones_select" on public.reservaciones for select to authenticated
    using (public.es_personal());
create policy "reservaciones_insert" on public.reservaciones for insert to authenticated
    with check (public.es_personal() and estado_pago = 'Pendiente');
-- El estado de pago solo cambia mediante procesar_pago()
create policy "reservaciones_update" on public.reservaciones for update to authenticated
    using (public.es_personal()) with check (public.es_personal());

-- Pagos, facturas, cierres y movimientos: solo lectura desde el navegador
create policy "pagos_select" on public.pagos for select to authenticated using (public.es_personal());
create policy "facturas_select" on public.facturas for select to authenticated using (public.es_personal());
create policy "cierres_select" on public.cierres_caja for select to authenticated using (public.es_admin());
create policy "movimientos_select" on public.movimientos_reserva for select to authenticated using (public.es_personal());

-- Impide que el navegador marque una reservación como pagada por su cuenta
create or replace function public.proteger_estado_pago()
returns trigger language plpgsql as $$
begin
    if new.estado_pago is distinct from old.estado_pago and current_user <> 'postgres' then
        raise exception 'El estado de pago solo puede cambiarse cobrando la reservación';
    end if;
    return new;
end;
$$;
drop trigger if exists trg_proteger_estado_pago on public.reservaciones;
create trigger trg_proteger_estado_pago before update on public.reservaciones
    for each row execute procedure public.proteger_estado_pago();

-- ------------------------------------------------------------
-- 8) Habitaciones de ejemplo (opcional)
-- ------------------------------------------------------------
insert into public.habitaciones (numero, tipo, precio_noche, estado)
values ('101', 'Individual', 35.00, 'Disponible'),
       ('102', 'Doble', 50.00, 'Disponible'),
       ('201', 'Matrimonial', 65.00, 'Disponible'),
       ('301', 'Suite', 120.00, 'Disponible')
on conflict (numero) do nothing;

-- ------------------------------------------------------------
-- 9) Tu administrador
-- ------------------------------------------------------------
-- Si ya habías creado tu admin en la v1, sigue siendo Administrador.
-- Si empiezas de cero: regístrate desde la web y luego corre esto
-- con TU correo para darte el primer rol de administrador:
--
-- update public.perfiles set rol = 'Administrador'
-- where id = (select id from auth.users where email = 'saravcr20@gmail.com');
