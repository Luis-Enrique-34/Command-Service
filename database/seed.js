// =====================================================================
//  Datos de demostración:  npm run db:seed        (agrega lo que falte)
//                          npm run db:seed -- --reset   (borra y recrea la demo)
//
//  Crea categorías, un administrador, proveedores (verificados y pendientes),
//  clientes, servicios y solicitudes en distintos estados, con su historial,
//  pagos, mensajes, reseñas y registros de auditoría.
//
//  Todas las cuentas demo usan el dominio @demo.commandservice.pe y la
//  contraseña indicada en DEMO_PASSWORD. NO toca las cuentas reales.
// =====================================================================
require("dotenv").config({ quiet: true });
const argon2 = require("argon2");
const { Client } = require("pg");
const { buildDbConfig } = require("../src/config/dbConfig");
const { explicarErrorDb } = require("../src/utils/dbErrors");

const DEMO_PASSWORD = "Demo2026!";
const DOMINIO = "demo.commandservice.pe";
const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const RESET = process.argv.includes("--reset");

const categorias = [
  ["Soporte técnico", "soporte-tecnico", "fa-screwdriver-wrench", "Reparación y mantenimiento de equipos"],
  ["Diseño gráfico", "diseno-grafico", "fa-palette", "Identidad visual, piezas para redes y branding"],
  ["Desarrollo web", "desarrollo-web", "fa-code", "Páginas web, tiendas online y sistemas"],
  ["Clases y tutorías", "clases-tutorias", "fa-chalkboard-user", "Reforzamiento escolar, idiomas y universidad"],
  ["Hogar y electricidad", "hogar-electricidad", "fa-plug", "Instalaciones eléctricas y reparaciones del hogar"],
  ["Marketing digital", "marketing-digital", "fa-bullhorn", "Gestión de redes, campañas y contenido"],
  ["Fotografía y video", "fotografia-video", "fa-camera", "Sesiones, eventos y edición audiovisual"],
  ["Contabilidad", "contabilidad", "fa-calculator", "Declaraciones, libros contables y asesoría tributaria"],
];

// [nombres, apellidos, usuario, rol, telefono, perfil?]
const usuarios = [
  ["Administrador", "Command Service", "admin", "admin", "+51 900 000 001"],
  ["Diego", "Salazar Ríos", "diego.salazar", "proveedor", "+51 987 111 201",
    { nombre: "TecnoFix Soporte", doc: "20601234561", distrito: "San Miguel", verif: "aprobado",
      desc: "Técnicos certificados en reparación de laptops, PCs y redes domésticas." }],
  ["Valeria", "Quispe Lazo", "valeria.quispe", "proveedor", "+51 987 111 202",
    { nombre: "Studio Valeria Diseño", doc: "10456789012", distrito: "Miraflores", verif: "aprobado",
      desc: "Diseñadora gráfica con 6 años de experiencia en branding para emprendimientos." }],
  ["Martín", "Huamán Torres", "martin.huaman", "proveedor", "+51 987 111 203",
    { nombre: "DevAndes Software", doc: "20605555123", distrito: "Surco", verif: "aprobado",
      desc: "Desarrollo web a medida, tiendas online y sistemas de gestión para PYMES." }],
  ["Rosa", "Mendoza Cáceres", "rosa.mendoza", "proveedor", "+51 987 111 204",
    { nombre: "Aprende con Rosa", doc: "45678912", distrito: "Los Olivos", verif: "aprobado",
      desc: "Docente de matemática y física. Clases presenciales y virtuales." }],
  ["Jorge", "Paredes Vilca", "jorge.paredes", "proveedor", "+51 987 111 205",
    { nombre: "Electro Paredes", doc: "10234567891", distrito: "Comas", verif: "pendiente",
      desc: "Instalaciones eléctricas domiciliarias y mantenimiento de tableros." }],
  ["Lucía", "Fernández Soto", "lucia.fernandez", "proveedor", "+51 987 111 206",
    { nombre: "Lucía Marketing", doc: null, distrito: "Jesús María", verif: "pendiente",
      desc: "Community manager y campañas en Meta Ads para negocios locales." }],
  ["Ana", "Torres Medina", "ana.torres", "cliente", "+51 912 222 301"],
  ["Miguel", "Rojas Paz", "miguel.rojas", "cliente", "+51 912 222 302"],
  ["Carla", "Vega Núñez", "carla.vega", "cliente", "+51 912 222 303"],
  ["Renzo", "Gutiérrez Silva", "renzo.gutierrez", "cliente", "+51 912 222 304"],
];

// [proveedor, categoria, titulo, descripcion, precio, modalidad, zona, horas]
const servicios = [
  ["diego.salazar", "soporte-tecnico", "Mantenimiento preventivo de laptop", "Limpieza interna, cambio de pasta térmica y optimización del sistema.", 90, "presencial", "Lima Oeste", 2],
  ["diego.salazar", "soporte-tecnico", "Formateo e instalación de software", "Respaldo de archivos, instalación de Windows y programas de oficina.", 70, "mixta", "Lima Metropolitana", 3],
  ["diego.salazar", "soporte-tecnico", "Configuración de red WiFi doméstica", "Instalación de router, repetidores y seguridad de la red.", 120, "presencial", "Lima Oeste", 2],
  ["valeria.quispe", "diseno-grafico", "Diseño de logotipo profesional", "Tres propuestas, dos rondas de cambios y manual básico de marca.", 350, "virtual", "Todo el Perú", 12],
  ["valeria.quispe", "diseno-grafico", "Pack de 10 piezas para redes sociales", "Diseños editables para Instagram y Facebook alineados a tu marca.", 220, "virtual", "Todo el Perú", 8],
  ["martin.huaman", "desarrollo-web", "Landing page para emprendimiento", "Página responsive con formulario de contacto y hosting por un año.", 900, "virtual", "Todo el Perú", 30],
  ["martin.huaman", "desarrollo-web", "Tienda online con pasarela de pagos", "Catálogo de productos, carrito y pagos con tarjeta o Yape.", 2500, "virtual", "Todo el Perú", 80],
  ["martin.huaman", "desarrollo-web", "Soporte mensual de sitio web", "Actualizaciones, copias de seguridad y monitoreo de disponibilidad.", 300, "virtual", "Todo el Perú", 10],
  ["rosa.mendoza", "clases-tutorias", "Clases de matemática escolar", "Reforzamiento para secundaria y preparación preuniversitaria (por hora).", 40, "mixta", "Lima Norte", 1],
  ["rosa.mendoza", "clases-tutorias", "Física universitaria: paquete de 8 horas", "Resolución de problemas de Física I y II con material incluido.", 280, "virtual", "Todo el Perú", 8],
  ["jorge.paredes", "hogar-electricidad", "Instalación de tomacorrientes y luminarias", "Incluye revisión del circuito y materiales básicos.", 80, "presencial", "Lima Norte", 2],
  ["jorge.paredes", "hogar-electricidad", "Mantenimiento de tablero eléctrico", "Ajuste de borneras, cambio de llaves y prueba de pozo a tierra.", 150, "presencial", "Lima Norte", 3],
  ["lucia.fernandez", "marketing-digital", "Gestión de redes sociales (1 mes)", "12 publicaciones, respuestas a mensajes y reporte mensual.", 600, "virtual", "Todo el Perú", 20],
  ["lucia.fernandez", "marketing-digital", "Campaña en Meta Ads", "Configuración, segmentación y optimización durante 15 días.", 450, "virtual", "Todo el Perú", 10],
];

// Cada solicitud recorre pasos [accion, diasDesdeCreacion, extra]
// cliente, servicio (por título), días atrás de creación, pasos
const solicitudes = [
  ["ana.torres", "Diseño de logotipo profesional", 42, "Necesito el logo para mi pastelería artesanal 'Dulce Ana'.", ["aceptar", "pagar:yape", "agendar", "iniciar", "completar"], { resena: [5, "Excelente trabajo, entendió la idea desde el primer boceto."] }],
  ["miguel.rojas", "Mantenimiento preventivo de laptop", 35, "La laptop se calienta mucho y se apaga sola.", ["aceptar", "pagar:tarjeta", "agendar", "iniciar", "completar"], { resena: [4, "Rápido y puntual. La laptop quedó como nueva."] }],
  ["carla.vega", "Landing page para emprendimiento", 28, "Landing para mi marca de ropa sostenible, con catálogo simple.", ["aceptar", "pagar:transferencia", "agendar", "iniciar", "completar"], { resena: [5, "Muy profesional, entregó antes de la fecha."] }],
  ["renzo.gutierrez", "Clases de matemática escolar", 20, "Reforzamiento de álgebra para mi hijo de 4.° de secundaria.", ["aceptar", "pagar:yape", "agendar", "iniciar", "completar"], {}],
  ["ana.torres", "Pack de 10 piezas para redes sociales", 12, "Piezas para la campaña de Navidad de la pastelería.", ["aceptar", "pagar:plin", "agendar", "iniciar"], { mensajes: true }],
  ["miguel.rojas", "Configuración de red WiFi doméstica", 9, "Departamento de 3 pisos, la señal no llega al tercero.", ["aceptar", "pagar:tarjeta", "agendar"], { futuro: 3 }],
  ["carla.vega", "Soporte mensual de sitio web", 7, "Soporte para la web que me desarrollaron en setiembre.", ["aceptar", "pagar:yape"], {}],
  ["renzo.gutierrez", "Física universitaria: paquete de 8 horas", 5, "Preparación para el examen final de Física I.", ["aceptar"], { mensajes: true }],
  ["ana.torres", "Tienda online con pasarela de pagos", 3, "Quiero vender mis tortas por internet con pagos por Yape.", [], {}],
  ["miguel.rojas", "Formateo e instalación de software", 2, "PC de escritorio con Windows muy lento.", [], {}],
  ["carla.vega", "Diseño de logotipo profesional", 1, "Logo para una nueva línea de accesorios.", [], {}],
  ["renzo.gutierrez", "Mantenimiento preventivo de laptop", 15, "Revisión de laptop antigua.", ["rechazar:No contamos con repuestos para ese modelo (2012)."], {}],
  ["carla.vega", "Clases de matemática escolar", 18, "Clases para mi sobrina.", ["cancelar:Conseguimos un profesor del colegio."], {}],
  ["miguel.rojas", "Landing page para emprendimiento", 50, "Landing para mi taller mecánico.", ["aceptar", "pagar:transferencia", "agendar", "iniciar", "completar"], { resena: [4, "Buen resultado, la comunicación pudo ser más rápida."] }],
];

const ESTADO_POR_ACCION = {
  aceptar: "aceptada", rechazar: "rechazada", pagar: "pago_confirmado", agendar: "agendada",
  iniciar: "en_curso", completar: "completada", cancelar: "cancelada",
};

const dias = (n) => new Date(Date.now() - n * 86_400_000);

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error("❌ Falta DATABASE_URL en el archivo .env");
    process.exit(1);
  }
  const { info, ...config } = buildDbConfig(process.env.DATABASE_URL);
  const client = new Client(config);
  try {
    await client.connect();
  } catch (err) {
    console.error("❌ No se pudo conectar:", err.message);
    explicarErrorDb(err, info).forEach((l) => console.error("   " + l));
    process.exit(1);
  }
  console.log(`🔌 Conectado a ${info.host}. Cargando datos de demostración...`);

  const existe = await client.query("SELECT to_regclass('public.solicitudes') AS t");
  if (!existe.rows[0].t) {
    console.error("❌ Faltan tablas. Ejecuta primero:  npm run db:init");
    process.exit(1);
  }

  try {
    await client.query("BEGIN");

    if (RESET) {
      const demo = `%@${DOMINIO}`;
      const deLaDemo = `SELECT s.id FROM public.solicitudes s
        WHERE s.cliente_id IN (SELECT id FROM public.usuarios WHERE email LIKE $1)
           OR s.proveedor_id IN (SELECT id FROM public.usuarios WHERE email LIKE $1)`;
      // pagos usa ON DELETE RESTRICT (no se borra dinero por accidente): se elimina explícitamente
      await client.query(`DELETE FROM public.pagos WHERE solicitud_id IN (${deLaDemo})`, [demo]);
      await client.query(
        `DELETE FROM public.solicitudes WHERE cliente_id IN (SELECT id FROM public.usuarios WHERE email LIKE $1)
            OR proveedor_id IN (SELECT id FROM public.usuarios WHERE email LIKE $1)`, [demo]);
      await client.query(`DELETE FROM public.auditoria WHERE usuario_id IN (SELECT id FROM public.usuarios WHERE email LIKE $1)`, [demo]);
      await client.query(`DELETE FROM public.usuarios WHERE email LIKE $1`, [demo]);
      // Reinicia la numeración SOL-000001 continuando desde el mayor código que quede
      await client.query(
        `SELECT setval('public.solicitudes_codigo_seq',
                COALESCE((SELECT MAX(SUBSTRING(codigo FROM 5)::INT) FROM public.solicitudes), 0) + 1, false)`);
      console.log("🧹 Datos demo anteriores eliminados");
    }

    // ---- Categorías (upsert por slug)
    for (const [nombre, slug, icono, descripcion] of categorias) {
      await client.query(
        `INSERT INTO public.categorias (nombre, slug, icono, descripcion) VALUES ($1,$2,$3,$4)
         ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre, icono = EXCLUDED.icono, descripcion = EXCLUDED.descripcion`,
        [nombre, slug, icono, descripcion]);
    }
    const { rows: cats } = await client.query("SELECT id, slug FROM public.categorias");
    const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

    // ---- Usuarios (un solo hash para todas las cuentas demo: más rápido)
    const hash = await argon2.hash(DEMO_PASSWORD, ARGON_OPTS);
    const { rows: admins } = await client.query("SELECT id FROM public.usuarios WHERE rol = 'admin' LIMIT 1");
    const userId = {};
    for (const [nombres, apellidos, user, rol, tel, perfil] of usuarios) {
      const email = `${user}@${DOMINIO}`;
      const { rows } = await client.query(
        `INSERT INTO public.usuarios (nombres, apellidos, email, telefono, password_hash, rol, creado_en)
         VALUES ($1,$2,$3,$4,$5,$6, NOW() - INTERVAL '60 days')
         ON CONFLICT (email) DO UPDATE SET nombres = EXCLUDED.nombres
         RETURNING id`, [nombres, apellidos, email, tel, hash, rol]);
      userId[user] = rows[0].id;
      if (perfil) {
        await client.query(
          `INSERT INTO public.perfiles_proveedor (usuario_id, nombre_comercial, documento, descripcion, distrito, verificacion, verificado_por, verificado_en)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (usuario_id) DO NOTHING`,
          [rows[0].id, perfil.nombre, perfil.doc, perfil.desc, perfil.distrito, perfil.verif,
           perfil.verif === "aprobado" ? (admins[0]?.id ?? null) : null,
           perfil.verif === "aprobado" ? dias(55) : null]);
      }
    }
    // El admin demo verifica a los aprobados (si no había otro admin)
    await client.query(
      `UPDATE public.perfiles_proveedor SET verificado_por = $1
        WHERE verificacion = 'aprobado' AND verificado_por IS NULL`, [userId.admin]);

    // ---- Servicios (no duplica si ya existe el mismo título para el proveedor)
    const servId = {};
    for (const [prov, cat, titulo, desc, precio, modalidad, zona, horas] of servicios) {
      const { rows: ya } = await client.query(
        "SELECT id FROM public.servicios WHERE proveedor_id = $1 AND titulo = $2", [userId[prov], titulo]);
      if (ya[0]) { servId[titulo] = { id: ya[0].id, prov, precio }; continue; }
      const { rows } = await client.query(
        `INSERT INTO public.servicios (proveedor_id, categoria_id, titulo, descripcion, precio, modalidad, zona_cobertura, duracion_horas, creado_en)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW() - INTERVAL '58 days') RETURNING id`,
        [userId[prov], catId[cat], titulo, desc, precio, modalidad, zona, horas]);
      servId[titulo] = { id: rows[0].id, prov, precio };
    }

    // ---- Solicitudes (solo si la demo aún no tiene)
    const { rows: hay } = await client.query(
      `SELECT COUNT(*)::int AS n FROM public.solicitudes s JOIN public.usuarios u ON u.id = s.cliente_id
        WHERE u.email LIKE $1`, [`%@${DOMINIO}`]);

    if (hay[0].n === 0) {
      for (const [cli, titulo, haceDias, desc, pasos, extra] of solicitudes) {
        const s = servId[titulo];
        const creado = dias(haceDias);
        await client.query("SELECT set_config('app.usuario_id', $1, true), set_config('app.comentario', 'Solicitud creada', true)", [userId[cli]]);
        const { rows } = await client.query(
          `INSERT INTO public.solicitudes (cliente_id, servicio_id, proveedor_id, monto, descripcion, direccion, fecha_preferida, creado_en)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [userId[cli], s.id, userId[s.prov], s.precio, desc, "Lima, Perú", creado, creado]);
        const solId = rows[0].id;
        await client.query(
          `UPDATE public.solicitud_historial SET creado_en = $2 WHERE solicitud_id = $1`, [solId, creado]);

        let t = creado.getTime();
        for (const paso of pasos) {
          const [accion, arg] = paso.split(":");
          t += (0.4 + Math.random() * 1.2) * 86_400_000;
          const fecha = new Date(Math.min(t, Date.now() - 3_600_000));
          const actor = ["pagar", "completar", "cancelar"].includes(accion) ? userId[cli] : userId[s.prov];
          await client.query("SELECT set_config('app.usuario_id', $1, true), set_config('app.comentario', $2, true)",
            [actor, arg && accion !== "pagar" ? arg : ""]);

          const campos = { estado: ESTADO_POR_ACCION[accion] };
          if (accion === "rechazar" || accion === "cancelar") campos.motivo = arg;
          if (accion === "agendar") {
            const prog = extra.futuro ? new Date(Date.now() + extra.futuro * 86_400_000) : new Date(fecha.getTime() + 86_400_000);
            prog.setUTCHours(15, 0, 0, 0); // 10:00 a. m. hora de Lima (UTC-5)
            campos.fecha_programada = prog;
          }
          const sets = Object.keys(campos).map((k, i) => `${k} = $${i + 2}`).join(", ");
          await client.query(`UPDATE public.solicitudes SET ${sets} WHERE id = $1`, [solId, ...Object.values(campos)]);
          await client.query(
            `UPDATE public.solicitud_historial SET creado_en = $2
              WHERE id = (SELECT MAX(id) FROM public.solicitud_historial WHERE solicitud_id = $1)`, [solId, fecha]);

          if (accion === "pagar") {
            await client.query(
              `INSERT INTO public.pagos (solicitud_id, monto, metodo, estado, referencia, creado_en)
               VALUES ($1,$2,$3,'retenido',$4,$5)`,
              [solId, s.precio, arg, `OP-${Math.floor(100000 + Math.random() * 899999)}`, fecha]);
          }
          if (accion === "completar") {
            await client.query(`UPDATE public.pagos SET estado = 'liberado', liberado_en = $2 WHERE solicitud_id = $1`, [solId, fecha]);
          }
        }

        if (extra.resena) {
          await client.query(
            `INSERT INTO public.resenas (solicitud_id, cliente_id, proveedor_id, puntaje, comentario, creado_en)
             VALUES ($1,$2,$3,$4,$5, NOW() - INTERVAL '1 day')`,
            [solId, userId[cli], userId[s.prov], extra.resena[0], extra.resena[1]]);
        }
        if (extra.mensajes) {
          const conv = [
            [userId[cli], "Hola, ¿podríamos coordinar los detalles por aquí?"],
            [userId[s.prov], "¡Claro! Te comparto un avance mañana a primera hora."],
            [userId[cli], "Perfecto, quedo atenta. Gracias."],
          ];
          for (const [i, [emisor, texto]] of conv.entries()) {
            await client.query(
              `INSERT INTO public.mensajes (solicitud_id, emisor_id, contenido, leido, creado_en)
               VALUES ($1,$2,$3, TRUE, NOW() - ($4 || ' hours')::interval)`, [solId, emisor, texto, String(30 - i * 6)]);
          }
        }
      }

      // Bitácora de ejemplo
      await client.query(
        `INSERT INTO public.auditoria (usuario_id, accion, entidad, entidad_id, ip, detalle, creado_en)
         SELECT verificado_por, 'VERIFICAR_PROVEEDOR', 'perfiles_proveedor', usuario_id::text, '127.0.0.1',
                jsonb_build_object('estado', 'aprobado', 'origen', 'seed'), verificado_en
           FROM public.perfiles_proveedor WHERE verificacion = 'aprobado' AND verificado_en IS NOT NULL`);
      console.log(`✅ ${solicitudes.length} solicitudes de ejemplo creadas (con historial, pagos, mensajes y reseñas)`);
    } else {
      console.log(`ℹ️  La demo ya tiene ${hay[0].n} solicitudes: no se duplican (usa --reset para recrearlas)`);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ Error cargando datos (no se guardó nada):", err.message);
    process.exitCode = 1;
    await client.end();
    return;
  }

  const { rows: resumen } = await client.query(`
    SELECT 'usuarios' AS tabla, COUNT(*) FROM public.usuarios UNION ALL
    SELECT 'perfiles_proveedor', COUNT(*) FROM public.perfiles_proveedor UNION ALL
    SELECT 'categorias', COUNT(*) FROM public.categorias UNION ALL
    SELECT 'servicios', COUNT(*) FROM public.servicios UNION ALL
    SELECT 'solicitudes', COUNT(*) FROM public.solicitudes UNION ALL
    SELECT 'solicitud_historial', COUNT(*) FROM public.solicitud_historial UNION ALL
    SELECT 'pagos', COUNT(*) FROM public.pagos UNION ALL
    SELECT 'mensajes', COUNT(*) FROM public.mensajes UNION ALL
    SELECT 'resenas', COUNT(*) FROM public.resenas UNION ALL
    SELECT 'auditoria', COUNT(*) FROM public.auditoria`);
  await client.end();

  console.log("\n📊 Registros por tabla:");
  resumen.forEach((r) => console.log(`   • ${r.tabla.padEnd(20)} ${r.count}`));
  console.log(`\n🔑 Cuentas demo (contraseña: ${DEMO_PASSWORD})`);
  console.log(`   Administrador: admin@${DOMINIO}`);
  console.log(`   Proveedor:     diego.salazar@${DOMINIO}   (verificado)`);
  console.log(`   Proveedor:     jorge.paredes@${DOMINIO}   (pendiente de verificación)`);
  console.log(`   Cliente:       ana.torres@${DOMINIO}`);
})();
