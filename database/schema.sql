-- =====================================================================
--  Command Service - Esquema de base de datos (PostgreSQL / Supabase)
--
--  Formas de ejecutarlo (elige UNA):
--   a) Desde la terminal:  npm run db:init
--   b) Supabase → SQL Editor → New query → pegar este archivo → Run
--
--  Se puede ejecutar varias veces sin problema (usa IF NOT EXISTS).
-- =====================================================================

-- Nota: gen_random_uuid() viene incluido en PostgreSQL 13+ (Supabase usa 15+),
-- por eso ya no hace falta la extensión pgcrypto.

-- Tipo enumerado para los roles de la plataforma
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rol_usuario') THEN
        CREATE TYPE public.rol_usuario AS ENUM ('cliente', 'proveedor', 'admin');
    END IF;
END$$;

-- ---------------------------------------------------------------------
--  Tabla de usuarios
--  * id UUID: no revela cuántos usuarios hay (a diferencia de 1, 2, 3...)
--  * password_hash: NUNCA se guarda la contraseña, solo su hash Argon2id
--  * email se guarda en minúsculas y es único
--  (Es independiente de la tabla auth.users de Supabase Auth: aquí la
--   autenticación la hace nuestro propio backend en Node.js.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombres             VARCHAR(80)  NOT NULL,
    apellidos           VARCHAR(80)  NOT NULL,
    email               VARCHAR(255) NOT NULL UNIQUE,
    telefono            VARCHAR(20),
    password_hash       TEXT         NOT NULL,
    rol                 public.rol_usuario NOT NULL DEFAULT 'cliente',
    activo              BOOLEAN      NOT NULL DEFAULT TRUE,
    intentos_fallidos   SMALLINT     NOT NULL DEFAULT 0,
    bloqueado_hasta     TIMESTAMPTZ,
    ultimo_login        TIMESTAMPTZ,
    creado_en           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT email_minusculas CHECK (email = LOWER(email))
);

-- Mantener actualizado_en automáticamente.
-- "SET search_path = ''" es una buena práctica de seguridad que además
-- evita la advertencia "Function Search Path Mutable" de Supabase.
CREATE OR REPLACE FUNCTION public.set_actualizado_en()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuarios_actualizado ON public.usuarios;
CREATE TRIGGER trg_usuarios_actualizado
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();

-- ---------------------------------------------------------------------
--  (Siguiente fase) Servicios publicados por los proveedores
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.servicios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    titulo          VARCHAR(120) NOT NULL,
    descripcion     TEXT,
    precio          NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servicios_proveedor ON public.servicios(proveedor_id);

-- =====================================================================
--  SEGURIDAD EN SUPABASE  (¡muy importante!)
--
--  Supabase ofrece una API REST automática (Data API) sobre el esquema
--  "public", usando los roles "anon" y "authenticated". Nuestra app NO usa
--  esa API: todo pasa por nuestro backend en Node.js. Por eso cerramos
--  el acceso por esa vía, para que nadie pueda leer la tabla usuarios
--  (con sus hashes) usando la "anon key" del proyecto.
--
--  1) Activamos Row Level Security (RLS) SIN políticas -> la API no ve filas.
--  2) Quitamos todos los permisos a los roles de la API.
--  Nuestro backend se conecta como "postgres" (dueño de las tablas), que no
--  se ve afectado por esto.
-- =====================================================================
ALTER TABLE public.usuarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r TEXT;
BEGIN
    -- Solo si existen los roles de Supabase (en un PostgreSQL local no existen)
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON TABLE public.usuarios, public.servicios FROM %I', r);
            EXECUTE format('REVOKE EXECUTE ON FUNCTION public.set_actualizado_en() FROM %I', r);
        END IF;
    END LOOP;
END$$;
