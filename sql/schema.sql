-- ============================================================
-- HotelControl - Esquema para Supabase (PostgreSQL)
-- ============================================================
-- Cómo usar: Ve a tu proyecto de Supabase > SQL Editor > New query,
-- pega TODO este archivo y presiona "Run".
-- ============================================================

-- ------------------------------------------------------------
-- 1) PERFILES (reemplaza la tabla "usuarios" original)
-- ------------------------------------------------------------
-- El login/contraseña ahora los maneja Supabase Auth (tabla
-- interna auth.users). Esta tabla solo guarda datos extra:
-- el nombre de usuario a mostrar y el rol (Administrador /
-- Recepcionista).
create table if not exists public.perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null,
    rol text not null default 'Recepcionista'
);

alter table public.perfiles enable row level security;

create policy "Perfiles: usuarios autenticados pueden leer"
    on public.perfiles for select
    to authenticated
    using (true);

create policy "Perfiles: un usuario edita su propio perfil"
    on public.perfiles for update
    to authenticated
    using (auth.uid() = id);

-- Crea automáticamente un perfil cuando se registra un usuario
-- nuevo en Supabase Auth (usa el "username" que se le pase en
-- las opciones del signUp, o la parte antes del @ del correo).
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.perfiles (id, username, rol)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data->>'rol', 'Recepcionista')
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.crear_perfil_nuevo_usuario();

-- ------------------------------------------------------------
-- 2) HABITACIONES
-- ------------------------------------------------------------
create table if not exists public.habitaciones (
    id bigint generated always as identity primary key,
    numero text unique not null,
    tipo text not null,
    precio_noche numeric(10, 2) not null,
    estado text not null default 'Disponible'
        check (estado in ('Disponible', 'Ocupada', 'Mantenimiento'))
);

alter table public.habitaciones enable row level security;

create policy "Habitaciones: acceso total a autenticados"
    on public.habitaciones for all
    to authenticated
    using (true)
    with check (true);

-- ------------------------------------------------------------
-- 3) HUÉSPEDES
-- ------------------------------------------------------------
create table if not exists public.huespedes (
    id bigint generated always as identity primary key,
    cedula_pasaporte text unique not null,
    nombre_completo text not null,
    telefono text,
    email text
);

alter table public.huespedes enable row level security;

create policy "Huespedes: acceso total a autenticados"
    on public.huespedes for all
    to authenticated
    using (true)
    with check (true);

-- ------------------------------------------------------------
-- 4) RESERVACIONES
-- ------------------------------------------------------------
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

alter table public.reservaciones enable row level security;

create policy "Reservaciones: acceso total a autenticados"
    on public.reservaciones for all
    to authenticated
    using (true)
    with check (true);

-- ------------------------------------------------------------
-- 5) Datos de ejemplo (opcional, comenta si no los quieres)
-- ------------------------------------------------------------
insert into public.habitaciones (numero, tipo, precio_noche, estado)
values
    ('101', 'Individual', 35.00, 'Disponible'),
    ('102', 'Doble', 50.00, 'Disponible'),
    ('201', 'Matrimonial', 65.00, 'Disponible'),
    ('301', 'Suite', 120.00, 'Disponible')
on conflict (numero) do nothing;

-- ------------------------------------------------------------
-- 6) Crear el usuario administrador
-- ------------------------------------------------------------
-- Esto NO se puede hacer por SQL directamente (Supabase Auth
-- gestiona las contraseñas de forma especial). Después de correr
-- este script:
--   1. Ve a Authentication > Users > "Add user" en el panel de Supabase.
--   2. Crea un usuario, por ejemplo con correo admin@hotelcontrol.com
--      y la contraseña que quieras. Marca "Auto Confirm User".
--   3. Luego corre esta consulta (cambiando el correo) para que
--      quede como Administrador y con el nombre "admin":
--
-- update public.perfiles set username = 'admin', rol = 'Administrador'
-- where id = (select id from auth.users where email = 'admin@hotelcontrol.com');
