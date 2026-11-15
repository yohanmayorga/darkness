# Reglas del Proyecto: Darkness

Este documento define las directrices técnicas, de diseño y de flujo de trabajo que cualquier agente de IA debe seguir al trabajar en **Darkness**.

## 1. Reglas de Comunicación y Flujo de Trabajo
1. **Idioma obligatorio:** Responder y documentar siempre en **español**.
2. **Enlaces de prueba local:** Cada vez que se cree o modifique una vista o funcionalidad, proporcionar al usuario el enlace directo de prueba para Live Server usando rutas con hash, por ejemplo:
   - `http://127.0.0.1:5501/#/dashboard`
   - `http://127.0.0.1:5501/#/habits`
   - `http://127.0.0.1:5501/#/body`
   - `http://127.0.0.1:5501/#/reading`
   - `http://127.0.0.1:5501/#/journal`
   - `http://127.0.0.1:5501/#/finance`
   - `http://127.0.0.1:5501/#/settings`
3. **Cache-Busting:** Siempre utilizar parámetros de versión (`?v=1.0.0`, incrementando en cada cambio relevante) en las referencias a archivos CSS y JS dentro de `index.html` y módulos para garantizar que tanto el navegador local como GitHub Pages carguen los cambios más recientes sin problemas de caché.

## 2. Identidad Visual y Diseño
1. **Estética Monocromática / Plata:**
   - Diseño minimalista, sobrio, funcional y de alto contraste sutil en escala de grises, negros profundos y acentos plata/blanco.
   - Los colores semánticos (éxito, alerta) deben ser discretos y elegantes, manteniendo el protagonismo del estilo monocromático.
2. **Modo Oscuro y Modo Claro:**
   - La aplicación debe soportar cambio fluido entre **Modo Oscuro** (`data-theme="dark"`, predeterminado) y **Modo Claro** (`data-theme="light"`), persistiendo la preferencia del usuario.
   - Todo color debe definirse mediante variables CSS en `assets/css/variables.css` (prohibido usar colores fijos/hardcoded fuera de las variables).
3. **Tipografía:**
   - Interfaz y textos largos (Diario, Lectura): Fuente sans-serif minimalista y compacta (`Plus Jakarta Sans`).
   - Datos numéricos, fechas, pesos, medidas, Memento Mori y montos financieros: Fuente monoespaciada (`IBM Plex Mono`) con `font-variant-numeric: tabular-nums`.

## 3. Arquitectura Web y Preparación Móvil (Android & iOS)
1. **Compatibilidad con GitHub Pages y Empaquetado Nativo (Capacitor / PWA):**
   - Mantener una arquitectura **SPA con Hash Routing (`#/...`)** sin dependencia de un servidor backend propio para el renderizado.
   - Incluir soporte **PWA** (`manifest.json`, metaetiquetas de Apple/Android) y mantener las rutas relativas para que el proyecto pueda empaquetarse directamente en **Android e iOS mediante Capacitor** sin reescribir código.
2. **Diseño Mobile-First y Ergonómico en Teléfonos:**
   - En escritorio: Sidebar lateral izquierda colapsable.
   - En móvil: Barra de navegación inferior fija (*Bottom Tab Bar*) de fácil alcance con el pulgar.
   - Respetar las áreas seguras de iPhone y Android (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`).
   - Botones y elementos interactivos con área táctil mínima de `44x44px` y sin `zoom` accidental en inputs móviles (`font-size: 16px` mínimo en campos de formulario).

## 4. Módulos Principales de Darkness
- **Dashboard (`#/dashboard`):** Resumen ejecutivo del día (hábitos pendientes, peso actual, lectura en curso, balance financiero y acceso rápido al diario).
- **Hábitos (`#/habits`):** Seguimiento diario, semanal y rachas.
- **Cuerpo (`#/body`):** Registro de peso, medidas corporales, % de grasa, gráficas de progreso y fotos comparativas.
- **Lectura (`#/reading`):** Biblioteca personal con libro actual/leídos, fechas de inicio y fin, modalidad (`Físico`, `Kindle`, `Audiolibro`, `PDF/Digital`), progreso, calificación y comentarios/notas.
- **Diario (`#/journal`):** Entradas personales, estado de ánimo, etiquetas y archivos adjuntos.
- **Finanzas (`#/finance`):** Control de ingresos, gastos, categorías, cuentas y presupuestos.
- **Ajustes (`#/settings`):** Cambio de tema (Oscuro/Claro), conexión a Supabase, gestión de perfil y exportación/respaldo de datos.

## 5. Seguridad y Privacidad
- Nunca subir credenciales privadas al repositorio.
- Cualquier archivo de configuración local (`js/config.local.js`) debe permanecer en `.gitignore`.
- Las tablas y buckets de Supabase deben utilizar **Row Level Security (RLS)** restringido exclusivamente al `auth.uid()` del usuario propietario.
