# NightDreams – Núcleo SPA (index.html & app.js) – README Técnico

---

## Resumen del Núcleo

NightDreams está diseñado como una **SPA modular** y **PWA moderna**.
El núcleo es la combinación de `index.html` (layout + helpers) y `app.js` (cerebro funcional, navegación y lógica central).
**Toda la lógica de negocio y navegación pasa por app.js.**
El HTML solo contiene helpers visuales, layout y nunca lógica duplicada ni SDKs.

---

## Estructura y responsabilidades

### 🟩 `index.html`

* Único punto de entrada de la PWA.
* Define el layout base (header, sidebar, main, nav inferior).
* Carga solo los helpers visuales y utilidades necesarias (carga perezosa de iconos, fuentes, etc).
* Nunca debe contener lógica de negocio, navegación, Firebase ni SDKs externos si se usa lazy-load.
* Incluye solo **un** `<script type="module" src="scripts/app.js"></script>` (¡No dupliques!).

### 🟦 `app.js`

* Núcleo funcional: inicializa Firebase, Service Worker, autenticación, y la navegación SPA.
* Controla la carga dinámica de cada página (inserta HTML y JS, ejecuta `init()`).
* Controla roles y estados de usuario (admin, promotor, pendiente, etc).
* Gestiona toda la lógica de eventos globales, limpieza de caché y notificaciones push.
* Es el ÚNICO responsable de inicializar Firebase y sus SDKs (no debe haber scripts Firebase en el HTML).

---

## Correcciones realizadas (checklist)

*

---

## Tareas futuras (to do / recomendaciones)

*

---

## Cómo añadir una nueva página a NightDreams

1. \*\*Crea un HTML en \*\*\`\` &#x20;
   Ejemplo: `/pages/informes.html`
2. \*\*Crea el script correspondiente en \*\*\`\` &#x20;
   Ejemplo: `/scripts/informes.js` &#x20;
   Debe exportar al menos una función `init()`, opcionalmente `cleanup()`.
3. **Agrega un botón de navegación** (en el nav inferior del HTML):

   ```html
   <button data-page="informes" class="nav-btn">Informes</button>
   ```
4. **¡Listo!** &#x20;
   Al pulsar el botón, el núcleo SPA (`app.js`) cargará automáticamente el HTML y el script, y ejecutará `init()`.

---

## Ejemplo de script de página unificado

```js
// scripts/ejemplo.js
export function init() {
  // Lógica específica de la página
  console.log('[Ejemplo] Página cargada');
}
export function cleanup() {
  // Limpieza (timers, listeners, etc) si es necesario
}
```

---

## IMPORTANTE: Mezclado y visualización universal de datos históricos

### 🚀 **Mezclar reservas antiguas (importadas de Google Sheets) y nuevas (Firebase) en la misma tabla**

* El sistema recolecta dinámicamente **todos los campos existentes en cualquier reserva** (de Sheets, Firebase o futuras fuentes).
* **No importa si los nombres de campos cambian, si hay campos extra o si reservas antiguas tienen estructura distinta.**
* Los encabezados de la tabla se generan automáticamente recorriendo TODOS los documentos de reservas:

  * Se usa un `Set` para recolectar todas las keys de todos los objetos, así la tabla se adapta sola a cualquier campo presente.
  * Ejemplo:

    ```js
    let columnasSet = new Set();
    reservasSnap.forEach(doc => {
      const data = doc.data();
      docs.push(data);
      Object.keys(data).forEach(col => columnasSet.add(col));
    });
    ```
* Primero se muestran los campos "importantes" (Club, Fecha, etc), luego cualquier campo adicional detectado.
* **Si en una reserva un campo no existe, la celda queda vacía**, pero así puedes migrar/importar sin romper nada.
* ¡Esto te permite hacer migraciones y mezclar históricos de Google Sheets o cualquier otra fuente, sin perder info, sin modificar nada a mano y sin bugs de campos faltantes!
* Si el día de mañana cambias la estructura, el sistema seguirá mostrando todos los datos presentes.

**Este enfoque es lo más avanzado y profesional en gestión de datos históricos en PWAs.**

---

## IMPORTANTE: Checklist para un index.html limpio

*

---

## IMPORTANTE: Checklist para un app.js robusto

*

---

## ¿Qué NO debe hacerse nunca?

* Nunca inicialices Firebase ni SDKs en el HTML si usas lazy-load en JS.
* Nunca dupliques scripts de lógica de la app.
* Nunca mezcles helpers visuales con lógica SPA.
* Nunca registres más de un Service Worker.

---

## Consejo para el equipo

> **El núcleo NightDreams es sagrado:**
>
> * El HTML es solo layout y helpers visuales.
> * Toda la lógica de negocio y navegación está en app.js y los scripts de cada página.
> * Así evitamos bugs difíciles, duplicidades y mantenemos una app robusta y escalable.

---

## ¿Dudas o problemas?

* Si una página no se carga correctamente, revisa la consola por errores de import/export, rutas o inicialización de Firebase.
* Si ves mensajes de “Firebase App named '\[DEFAULT]' already exists”, revisa que no haya scripts SDK duplicados.
* Si quieres limpiar por completo la app, limpia caché desde admin o fuerza reload.

---

# **NightDreams PWA – Un solo núcleo, infinitas posibilidades** 🚀
