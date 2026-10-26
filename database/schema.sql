-- =====================================================================
--  Command Service - Esquema de base de datos (PostgreSQL / Supabase)
--  Versión 2 (APF3): módulos de oferta, solicitudes, pagos y control.
--
--  Formas de ejecutarlo (elige UNA):
--   a) Desde la terminal:  npm run db:init
--   b) Supabase → SQL Editor → New query → pegar este archivo → Run
--
--  Es IDEMPOTENTE: se puede ejecutar varias veces sin perder datos
--  (usa IF NOT EXISTS, ADD COLUMN IF NOT EXISTS y CREATE OR REPLACE).
--
--  Modelo (3FN). Entidad central: SOLICITUD.
--    usuarios 1─1 perfiles_proveedor
--    categorias 1─N servicios N─1 usuarios(proveedor)
--    solicitudes N─1 servicios / usuarios(cliente) / usuarios(proveedor)
--    solicitudes 1─N solicitud_historial   (lo llena un TRIGGER)
--    solicitudes 1─1 pagos                 (custodia simulada)
--    solicitudes 1─N mensajes
--    solicitudes 1─1 resenas
--    auditoria: bitácora de operaciones críticas (solo inserción)
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Tipos enumerados (controlan los valores válidos desde la BD)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rol_usuario') THEN
        CREATE TYPE public.rol_usuario AS ENUM ('cliente', 'proveedor', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modalidad_servicio') THEN
        CREATE TYPE public.modalidad_servicio AS ENUM ('presencial', 'virtual', 'mixta');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_verificacion') THEN
        CREATE TYPE public.estado_verificacion AS ENUM ('pendiente', 'aprobado', 'rechazado');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_solicitud') THEN
        CREATE TYPE public.estado_solicitud AS ENUM (
            'por_confirmar', 'aceptada', 'rechazada', 'pago_confirmado',
            'agendada', 'en_curso', 'completada', 'cancelada');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_pago') THEN
        CREATE TYPE public.estado_pago AS ENUM ('pendiente', 'retenido', 'liberado', 'reembolsado');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metodo_pago') THEN
        CREATE TYPE public.metodo_pago AS ENUM ('tarjeta', 'yape', 'plin', 'transferencia');
    END IF;
END$$;

-- Función genérica para mantener "actualizado_en".
-- "SET search_path = ''" es una buena práctica de seguridad y evita la
-- advertencia "Function Search Path Mutable" de Supabase.
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

-- ---------------------------------------------------------------------
--  2. usuarios  (autenticación propia del backend; independiente de auth.users)
--  * id UUID: no revela cuántos usuarios hay (a diferencia de 1, 2, 3...)
--  * password_hash: NUNCA la contraseña, solo su hash Argon2id
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

DROP TRIGGER IF EXISTS trg_usuarios_actualizado ON public.usuarios;
CREATE TRIGGER trg_usuarios_actualizado
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();

CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON public.usuarios(rol);

-- ---------------------------------------------------------------------
--  3. perfiles_proveedor  (1:1 con usuarios de rol proveedor)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perfiles_proveedor (
    usuario_id        UUID PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nombre_comercial  VARCHAR(120) NOT NULL,
    documento         VARCHAR(15),                         -- DNI (8) o RUC (11)
    descripcion       TEXT,
    distrito          VARCHAR(80),
    verificacion      public.estado_verificacion NOT NULL DEFAULT 'pendiente',
    motivo_rechazo    VARCHAR(255),
    verificado_por    UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    verificado_en     TIMESTAMPTZ,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT documento_formato CHECK (documento IS NULL OR documento ~ '^[0-9]{8}([0-9]{3})?$')
);

DROP TRIGGER IF EXISTS trg_perfiles_actualizado ON public.perfiles_proveedor;
CREATE TRIGGER trg_perfiles_actualizado
    BEFORE UPDATE ON public.perfiles_proveedor
    FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();

CREATE INDEX IF NOT EXISTS idx_perfiles_verificacion ON public.perfiles_proveedor(verificacion);

-- ---------------------------------------------------------------------
--  4. categorias  (catálogo maestro)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categorias (
    id           SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre       VARCHAR(60)  NOT NULL UNIQUE,
    slug         VARCHAR(60)  NOT NULL UNIQUE,
    icono        VARCHAR(40)  NOT NULL DEFAULT 'fa-briefcase',   -- clase Font Awesome
    descripcion  VARCHAR(255),
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT slug_formato CHECK (slug ~ '^[a-z0-9-]+$')
);

-- ---------------------------------------------------------------------
--  5. servicios  (publicados por proveedores)
--  En la versión 1 solo tenía título, descripción y precio: aquí se amplía
--  sin perder datos con ADD COLUMN IF NOT EXISTS.
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

ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS categoria_id   SMALLINT REFERENCES public.categorias(id) ON DELETE SET NULL;
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS modalidad      public.modalidad_servicio NOT NULL DEFAULT 'presencial';
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS zona_cobertura VARCHAR(120);
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS duracion_horas NUMERIC(4,1) CHECK (duracion_horas IS NULL OR duracion_horas > 0);
ALTER TABLE public.servicios ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_servicios_actualizado ON public.servicios;
CREATE TRIGGER trg_servicios_actualizado
    BEFORE UPDATE ON public.servicios
    FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();

CREATE INDEX IF NOT EXISTS idx_servicios_proveedor ON public.servicios(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_servicios_categoria ON public.servicios(categoria_id) WHERE activo;

-- ---------------------------------------------------------------------
--  6. solicitudes  (el "expediente" de cada contratación)
--  codigo legible: SOL-000001 (secuencia), además del UUID interno.
-- ---------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.solicitudes_codigo_seq;

CREATE TABLE IF NOT EXISTS public.solicitudes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo            VARCHAR(12) NOT NULL UNIQUE
                      DEFAULT ('SOL-' || LPAD(nextval('public.solicitudes_codigo_seq')::TEXT, 6, '0')),
    cliente_id        UUID NOT NULL REFERENCES public.usuarios(id)  ON DELETE RESTRICT,
    servicio_id       UUID NOT NULL REFERENCES public.servicios(id) ON DELETE RESTRICT,
    proveedor_id      UUID NOT NULL REFERENCES public.usuarios(id)  ON DELETE RESTRICT,
    estado            public.estado_solicitud NOT NULL DEFAULT 'por_confirmar',
    monto             NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    descripcion       VARCHAR(1000) NOT NULL,
    direccion         VARCHAR(200),
    fecha_preferida   DATE,
    fecha_programada  TIMESTAMPTZ,
    motivo            VARCHAR(255),          -- motivo de rechazo / cancelación
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cliente_distinto_proveedor CHECK (cliente_id <> proveedor_id)
);

ALTER SEQUENCE public.solicitudes_codigo_seq OWNED BY public.solicitudes.codigo;

DROP TRIGGER IF EXISTS trg_solicitudes_actualizado ON public.solicitudes;
CREATE TRIGGER trg_solicitudes_actualizado
    BEFORE UPDATE ON public.solicitudes
    FOR EACH ROW EXECUTE FUNCTION public.set_actualizado_en();

CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente   ON public.solicitudes(cliente_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_proveedor ON public.solicitudes(proveedor_id, estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_servicio  ON public.solicitudes(servicio_id);

-- ---------------------------------------------------------------------
--  7. solicitud_historial  (línea de tiempo de estados)
--  La llena un TRIGGER: así es imposible cambiar un estado sin dejar huella.
--  El backend indica quién hizo el cambio con:
--     SELECT set_config('app.usuario_id', '<uuid>', true);  (solo dura la transacción)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitud_historial (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    solicitud_id     UUID NOT NULL REFERENCES public.solicitudes(id) ON DELETE CASCADE,
    estado_anterior  public.estado_solicitud,
    estado_nuevo     public.estado_solicitud NOT NULL,
    cambiado_por     UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    comentario       VARCHAR(255),
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historial_solicitud ON public.solicitud_historial(solicitud_id, creado_en);

CREATE OR REPLACE FUNCTION public.registrar_historial_solicitud()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.estado IS DISTINCT FROM OLD.estado THEN
        INSERT INTO public.solicitud_historial (solicitud_id, estado_anterior, estado_nuevo, cambiado_por, comentario)
        VALUES (
            NEW.id,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.estado END,
            NEW.estado,
            NULLIF(current_setting('app.usuario_id', true), '')::UUID,
            NULLIF(current_setting('app.comentario', true), '')
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_solicitudes_historial ON public.solicitudes;
CREATE TRIGGER trg_solicitudes_historial
    AFTER INSERT OR UPDATE OF estado ON public.solicitudes
    FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_solicitud();

-- ---------------------------------------------------------------------
--  8. pagos  (custodia simulada: retenido → liberado / reembolsado)
--  comision y neto_proveedor son COLUMNAS GENERADAS: la BD las calcula,
--  nadie puede guardar un neto que no cuadre con el monto.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pagos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitud_id    UUID NOT NULL UNIQUE REFERENCES public.solicitudes(id) ON DELETE RESTRICT,
    monto           NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    comision_pct    NUMERIC(5,2)  NOT NULL DEFAULT 10.00 CHECK (comision_pct BETWEEN 0 AND 50),
    comision        NUMERIC(10,2) GENERATED ALWAYS AS (ROUND(monto * comision_pct / 100, 2)) STORED,
    neto_proveedor  NUMERIC(10,2) GENERATED ALWAYS AS (monto - ROUND(monto * comision_pct / 100, 2)) STORED,
    metodo          public.metodo_pago NOT NULL,
    estado          public.estado_pago NOT NULL DEFAULT 'retenido',
    referencia      VARCHAR(40),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    liberado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pagos_estado ON public.pagos(estado, creado_en);

-- ---------------------------------------------------------------------
--  9. mensajes  (comunicación asociada a la solicitud)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mensajes (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    solicitud_id  UUID NOT NULL REFERENCES public.solicitudes(id) ON DELETE CASCADE,
    emisor_id     UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    contenido     VARCHAR(1000) NOT NULL CHECK (LENGTH(TRIM(contenido)) > 0),
    leido         BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_solicitud ON public.mensajes(solicitud_id, creado_en);

-- ---------------------------------------------------------------------
--  10. resenas  (una por solicitud completada)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resenas (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    solicitud_id  UUID NOT NULL UNIQUE REFERENCES public.solicitudes(id) ON DELETE CASCADE,
    cliente_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    proveedor_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    puntaje       SMALLINT NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
    comentario    VARCHAR(500),
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resenas_proveedor ON public.resenas(proveedor_id);

-- ---------------------------------------------------------------------
--  11. auditoria  (bitácora de operaciones críticas, solo inserción)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auditoria (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id  UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    accion      VARCHAR(40) NOT NULL,     -- LOGIN, LOGIN_FALLIDO, CREAR_SOLICITUD, ...
    entidad     VARCHAR(40),
    entidad_id  VARCHAR(64),
    ip          VARCHAR(45),
    detalle     JSONB,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha   ON public.auditoria(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria(usuario_id, creado_en DESC);

-- =====================================================================
--  SEGURIDAD EN SUPABASE  (¡muy importante!)
--
--  Supabase expone una API REST automática (Data API) sobre "public" con
--  los roles "anon" y "authenticated". Nuestra app NO usa esa API: todo
--  pasa por el backend en Node.js. Por eso se cierra esa vía:
--   1) RLS activado SIN políticas  -> la API no ve ninguna fila.
--   2) Se revocan permisos de tablas, secuencias y funciones a esos roles.
--  El backend se conecta como dueño de las tablas y no se ve afectado.
-- =====================================================================
ALTER TABLE public.usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_proveedor  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitud_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resenas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria           ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r TEXT;
BEGIN
    -- Solo si existen los roles de Supabase (en un PostgreSQL local no existen)
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM %I', r);
            EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
            EXECUTE format('REVOKE EXECUTE ON FUNCTION public.set_actualizado_en() FROM %I', r);
            EXECUTE format('REVOKE EXECUTE ON FUNCTION public.registrar_historial_solicitud() FROM %I', r);
        END IF;
    END LOOP;
END$$;
