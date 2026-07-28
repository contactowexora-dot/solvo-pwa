/**
 * SOLVO — Cliente de la API.
 * Manual 2 §6.5 (forma de la respuesta) · §6.6 (CORS con Apps Script).
 *
 * TRES COSAS QUE APPS SCRIPT OBLIGA Y QUE NO SON NEGOCIABLES:
 *
 *   1. `Content-Type: text/plain;charset=utf-8`. Apps Script **no responde a OPTIONS**, así
 *      que la petición tiene que ser «simple» para el navegador. Con `application/json` el
 *      navegador dispara un preflight, Apps Script no lo contesta y la petición muere con un
 *      error de CORS que no dice nada. El cuerpo sigue siendo JSON; solo miente la cabecera.
 *
 *   2. `redirect: 'follow'`. Un despliegue web responde 302 hacia googleusercontent.com y
 *      el resultado real está ahí. Sin seguir la redirección se recibe el 302 vacío.
 *
 *   3. Nunca `credentials`. Enviar cookies convierte la petición en no-simple y vuelve al
 *      punto 1.
 *
 * La respuesta es siempre `{ok: true, datos}` o `{ok: false, error}`, y el `error` viene en
 * español y accionable: se muestra tal cual (§6.5). Traducirlo aquí sería duplicar la
 * decisión y desincronizarla.
 */
const Api = (function () {

  /** Peticiones en curso, por si hay que cancelarlas al cambiar de pantalla. */
  const enVuelo = new Map();

  /** Errores que significan «no hay red», no «el servidor dijo que no». */
  function esFalloDeRed(e) {
    return e instanceof TypeError ||
           /network|failed to fetch|load failed/i.test(String(e && e.message));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CACHÉ LOCAL — velocidad PERCIBIDA, no velocidad real (docs/TRASPASO.md §1.H/I)
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Apps Script tiene un piso de latencia (la redirección obligatoria a
  // googleusercontent.com + el arranque del propio motor) que ningún código de aquí
  // puede bajar. Lo que SÍ se puede hacer: no obligar a nadie a mirar un esqueleto de
  // carga para ver números que ya vio la vez anterior. `leer()` pinta al instante lo
  // último que se guardó EN ESTE TELÉFONO, y pide lo de verdad por detrás — la espera
  // del servidor sigue ahí, pero ya no la sufre el usuario mirando la pantalla.
  //
  // Deliberadamente en `localStorage`, no en memoria: sobrevive a cerrar la pestaña,
  // que es justo cuando más se nota — abrir la app y ver el saldo de ayer al instante,
  // en vez de un esqueleto, mientras se confirma que sigue siendo el mismo.

  const PREFIJO_CACHE_LOCAL = 'solvo.cache:';

  /**
   * Espejo exacto de la sección «Lectura» de `backend/Router.gs`. Si el backend suma
   * una acción de lectura ahí, hay que sumarla aquí — si no, sus escrituras (que caen
   * todas en el `else`, más abajo) la tratarían como sospechosa de haber cambiado algo
   * y limpiarían la caché local sin necesidad.
   */
  const ACCIONES_LECTURA = new Set([
    'catalogos', 'inicio.resumen', 'dashboard.datos',
    'movimientos.listar', 'movimientos.detalle', 'cobros.pendientes',
    'presupuesto.estado', 'productos.listar', 'productos.detalle', 'tarjeta.fechas',
    'objetivos.listar', 'objetivos.detalle', 'insights.listar', 'acciones.listar',
    'pendientes.listar', 'suscripciones.listar', 'categorias.listar', 'etiquetas.listar',
    'reglas.listar', 'caja.estado', 'caja.conceptos', 'plantilla.listar',
    'responsables.listar', 'feriados.listar'
  ]);

  function claveCacheLocal_(accion, params) {
    return PREFIJO_CACHE_LOCAL + accion + ':' + JSON.stringify(params || {});
  }

  function leerCacheLocal_(clave) {
    try {
      const v = localStorage.getItem(clave);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }

  function escribirCacheLocal_(clave, datos) {
    try { localStorage.setItem(clave, JSON.stringify(datos)); }
    catch (e) { /* modo privado o localStorage lleno: se sigue sin caché local */ }
  }

  /**
   * Se llama tras cada escritura exitosa. Más vale de más que servir un dato viejo
   * (mismo criterio que `Cache.invalidar` en el backend, Manual 2 §9.3): no se intenta
   * adivinar qué pantallas concretas tocó esta escritura, se limpia toda la caché
   * local de lectura y que la próxima visita a cada una vuelva a pedir lo suyo.
   */
  function limpiarCacheLocal_() {
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(PREFIJO_CACHE_LOCAL) === 0) localStorage.removeItem(k);
      });
    } catch (e) { /* nada que limpiar si localStorage no responde */ }
  }

  /**
   * Llama a una acción del Router.
   * @param {string} accion            p. ej. 'inicio.resumen'
   * @param {Object} [params]          parámetros de la acción
   * @param {Object} [opciones]
   * @param {boolean} [opciones.sinToken]  para la única llamada que no necesita sesión
   * @param {string}  [opciones.clave]     descarta la respuesta si se repite la misma clave
   * @return {Promise<*>} los `datos`, ya desenvueltos
   */
  async function llamar(accion, params, opciones) {
    const cfg = window.SOLVO_CONFIG;
    const op = opciones || {};

    if (!cfg.completa()) {
      throw new ErrorSolvo('Solvo no está configurado todavía.', { configuracion: true });
    }

    const cuerpo = Object.assign({ accion: accion }, params || {});
    if (!op.sinToken) {
      const token = await Auth.tokenValido();
      if (!token) throw new ErrorSolvo('Inicia sesión para continuar.', { sesion: true });
      cuerpo.idToken = token;
    }

    // Si la misma clave vuelve a pedirse, la anterior ya no interesa: al cambiar de
    // periodo tres veces seguidas solo importa la última.
    if (op.clave && enVuelo.has(op.clave)) enVuelo.get(op.clave).abort();
    const control = new AbortController();
    if (op.clave) enVuelo.set(op.clave, control);

    let resp;
    try {
      resp = await fetch(cfg.apiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(cuerpo),
        redirect: 'follow',
        signal: control.signal
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new ErrorSolvo('cancelada', { cancelada: true });
      if (esFalloDeRed(e)) {
        // `fetch` lanza el MISMO TypeError si no hay red y si el navegador bloqueó la
        // respuesta por CORS. Distinguirlos importa muchísimo: decir «sin conexión» a quien
        // acaba de entrar con Google manda a buscar el problema donde no está.
        //
        // El caso real más frecuente es un despliegue publicado con acceso «Solo yo»:
        // Apps Script redirige a la pantalla de acceso de Google, el navegador la bloquea
        // por CORS, y `fetch` falla igual que si no hubiera wifi.
        if (!navigator.onLine) {
          throw new ErrorSolvo(
            'Sin conexión. Lo intentaré de nuevo cuando vuelvas a estar en línea.',
            { sinRed: true });
        }
        throw new ErrorSolvo(
          'No pude hablar con el servidor de Solvo. Casi siempre es que el despliegue web no ' +
          'está publicado con acceso «Cualquier usuario» — ojo, no vale «Cualquier usuario ' +
          'con una cuenta de Google».',
          // El mensaje interno del navegador se guarda para enseñarlo en el panel: pedirle
          // a alguien que abra DevTools para leer una línea es una barrera innecesaria.
          { despliegue: true, url: cfg.apiUrl(), interno: String((e && e.message) || e) });
      }
      throw new ErrorSolvo('No pudimos contactar con el servidor. Reintenta.');
    } finally {
      if (op.clave && enVuelo.get(op.clave) === control) enVuelo.delete(op.clave);
    }

    if (!resp.ok) {
      // Un 401/403 de Apps Script casi siempre es el despliegue mal configurado, no el
      // usuario: decirle «inicia sesión» lo mandaría a un bucle.
      if (resp.status === 401 || resp.status === 403) {
        throw new ErrorSolvo(
          'El servidor rechazó la petición. Revisa que el despliegue web esté publicado ' +
          'con acceso «Cualquier persona».', { despliegue: true });
      }
      throw new ErrorSolvo('El servidor respondió ' + resp.status + '. Reintenta en un momento.');
    }

    const texto = await resp.text();
    let json;
    try {
      json = JSON.parse(texto);
    } catch (e) {
      // Apps Script devuelve HTML cuando el despliegue exige inicio de sesión de Google
      // o cuando el script lanzó antes de llegar a nuestro manejador.
      if (/<html/i.test(texto)) {
        throw new ErrorSolvo(
          'El despliegue web está pidiendo iniciar sesión de Google. Vuelve a publicarlo ' +
          'con «Ejecutar como: yo» y «Quién tiene acceso: cualquier persona».',
          { despliegue: true });
      }
      throw new ErrorSolvo('El servidor devolvió una respuesta que no entiendo.');
    }

    if (json.ok === false) {
      const msg = String(json.error || 'Algo falló en el servidor.');
      throw new ErrorSolvo(msg, {
        // Estos dos mensajes vienen literales de Auth.validar y necesitan volver a la puerta.
        sesion: /inicia sesión|sesión inválida/i.test(msg),
        sinAcceso: /no tiene acceso/i.test(msg)
      });
    }
    // Cualquier acción que no esté en la lista de lectura se trata como escritura:
    // más vale limpiar de más que dejar un número viejo pintado en otra pantalla.
    if (!ACCIONES_LECTURA.has(accion)) limpiarCacheLocal_();
    return json.datos;
  }

  /**
   * Como `llamar`, pero para las pantallas que pintan TODO su contenido a partir de
   * una sola respuesta (Inicio, Movimientos, Productos, Dashboard, Objetivos): si hay
   * algo guardado en este teléfono de la última vez, `alDatos` se llama con eso de
   * inmediato —sin esperar red—, y otra vez cuando llega la respuesta real.
   *
   * Si los dos resultados son idénticos (el caso común: nada cambió desde la última
   * visita), `alDatos` NO se vuelve a llamar — repintar con lo mismo solo arriesgaría
   * un parpadeo o remontar un gráfico sin necesidad.
   *
   * @param {Function} alDatos (datos, esFresco) → void. `esFresco` es `false` en la
   *   llamada instantánea con caché, `true` cuando responde el servidor.
   * @return {Promise<*>} los datos frescos — o los cacheados, si la red falla y ya se
   *   había mostrado algo (mejor lo último visto que una pantalla de error).
   */
  async function leer(accion, params, opciones, alDatos) {
    const clave = claveCacheLocal_(accion, params);
    const cacheado = leerCacheLocal_(clave);
    let mostroCacheado = false;
    if (cacheado !== null) {
      // Se ESPERA a que termine de pintar antes de seguir. `alDatos` suele ser una
      // función async que monta gráficos (§9.1: ECharts en diferido) — sin este
      // `await`, la llamada de red de abajo podía resolver ANTES de que la pintada
      // con caché terminara, y las dos pintadas se pisaban: la fresca destruía
      // gráficos que la de caché todavía no había montado, o al revés.
      await alDatos(cacheado, false);
      mostroCacheado = true;
    }

    try {
      const datos = await llamar(accion, params, opciones);
      escribirCacheLocal_(clave, datos);
      if (!mostroCacheado || JSON.stringify(datos) !== JSON.stringify(cacheado)) {
        await alDatos(datos, true);
      }
      return datos;
    } catch (e) {
      // Con algo ya en pantalla, un fallo de red silencioso no debe tumbarla: se
      // avisa aparte y se conserva lo que se veía. Sin nada mostrado, el error sigue
      // su curso normal (la pantalla lo muestra, como hoy).
      if (mostroCacheado && (e && (e.sinRed || esFalloDeRed(e) || e.cancelada))) {
        return cacheado;
      }
      throw e;
    }
  }

  /** Varias acciones en paralelo. Devuelve un objeto con las mismas claves. */
  async function varias(mapa, opciones) {
    const claves = Object.keys(mapa);
    const res = await Promise.allSettled(
      claves.map(function (k) {
        const v = mapa[k];
        return llamar(Array.isArray(v) ? v[0] : v, Array.isArray(v) ? v[1] : {}, opciones);
      }));
    const salida = {};
    const fallos = [];
    res.forEach(function (r, i) {
      if (r.status === 'fulfilled') salida[claves[i]] = r.value;
      else { salida[claves[i]] = null; fallos.push(r.reason); }
    });
    // Una tarjeta que falla no debe tumbar la pantalla entera, pero tampoco se calla:
    // quien llama decide qué hacer con `_fallos`.
    salida._fallos = fallos;
    return salida;
  }

  return { llamar: llamar, leer: leer, varias: varias, esFalloDeRed: esFalloDeRed,
            _limpiarCacheLocal: limpiarCacheLocal_ };
})();

/**
 * Error con contexto. Las banderas son lo que permite a `app.js` decidir sin volver a
 * inspeccionar la cadena del mensaje en cinco sitios distintos.
 */
class ErrorSolvo extends Error {
  constructor(mensaje, banderas) {
    super(mensaje);
    this.name = 'ErrorSolvo';
    Object.assign(this, banderas || {});
  }
}
