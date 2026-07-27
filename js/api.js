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
          'No pude hablar con el servidor de Solvo. Casi siempre es una de dos: el despliegue ' +
          'web no está publicado con acceso «Cualquier persona», o API_URL no apunta al ' +
          'backend.', { despliegue: true, url: cfg.apiUrl() });
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
    return json.datos;
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

  return { llamar: llamar, varias: varias, esFalloDeRed: esFalloDeRed };
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
