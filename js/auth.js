/**
 * SOLVO — Acceso con Google.
 * Manual 4 §B · Manual 5 §D (guardián de acceso).
 *
 * LO QUE ESTE ARCHIVO **NO** HACE, y es lo importante:
 *
 *   No decide si alguien tiene acceso. Ni lo intenta. Consigue un ID token de Google y lo
 *   manda; quien decide es el servidor, con dos verificaciones independientes del mismo
 *   token (Solvo para saber quién opera, el Guardián para autorizar). Un `if` aquí sobre el
 *   correo del usuario sería teatro: cualquiera con las herramientas del navegador lo salta.
 *
 *   Tampoco guarda el correo como credencial. El token es la credencial; el correo que se
 *   muestra en la interfaz sale de decodificar el token **solo para pintarlo**, y viene
 *   marcado como tal.
 *
 * SOBRE LA CADUCIDAD, que condiciona el modo sin conexión:
 *   Un ID token de Google dura una hora y **solo se puede renovar en línea**. Por eso las
 *   lecturas sin conexión salen de la caché del Service Worker, y pasada la hora hace falta
 *   red para volver a operar. No hay forma de evitarlo sin inventar una sesión propia, que
 *   es exactamente la clase de credencial que el Manual 5 §D.1 no quiere en el navegador.
 */
const Auth = (function () {

  const CLAVE_TOKEN = 'solvo.idToken';
  const GIS = 'https://accounts.google.com/gsi/client';

  let perfil = null;            // {correo, nombre, foto} — SOLO para mostrar
  let gisCargado = false;
  let alCambiar = function () {};
  let renovando = null;

  // ── Token ─────────────────────────────────────────────────────────────────

  /** Payload del JWT sin verificar firma. Sirve para pintar y para leer `exp`, nada más. */
  function leerPayload(token) {
    try {
      const base = String(token).split('.')[1];
      const json = atob(base.replace(/-/g, '+').replace(/_/g, '/'));
      // El JWT viene en UTF-8; atob da latin1 y parte los acentos de un nombre propio.
      return JSON.parse(decodeURIComponent(escape(json)));
    } catch (e) {
      return null;
    }
  }

  function guardar(token) {
    const p = leerPayload(token);
    if (!p || !p.exp || !p.email) return false;
    localStorage.setItem(CLAVE_TOKEN, token);
    perfil = {
      correo: String(p.email).toLowerCase(),
      nombre: p.name || p.given_name || '',
      foto: p.picture || '',
      expira: p.exp * 1000,
      // Recordatorio explícito en el objeto: nada de esto está verificado en el cliente.
      _sinVerificar: true
    };
    return true;
  }

  function minutosRestantes() {
    if (!perfil || !perfil.expira) return 0;
    return (perfil.expira - Date.now()) / 60000;
  }

  /** El token si sirve; si le queda poco, intenta renovarlo antes de devolverlo. */
  async function tokenValido() {
    const token = localStorage.getItem(CLAVE_TOKEN);
    if (!token) return null;
    if (!perfil) guardar(token);
    if (!perfil) { cerrarSesion(); return null; }

    const margen = window.SOLVO_CONFIG.MINUTOS_MARGEN_TOKEN;
    if (minutosRestantes() > margen) return token;

    // Caducado o a punto. Se intenta renovar sin molestar al usuario; si no se puede
    // —normalmente por no haber red— se devuelve null y la app vuelve a la puerta.
    const nuevo = await renovarSilencioso();
    return nuevo || null;
  }

  function sesionActiva() {
    if (!perfil) {
      const t = localStorage.getItem(CLAVE_TOKEN);
      if (t) guardar(t);
    }
    return !!perfil && minutosRestantes() > 0;
  }

  function perfilActual() { return perfil; }

  function cerrarSesion(motivo) {
    localStorage.removeItem(CLAVE_TOKEN);
    const habia = !!perfil;
    perfil = null;
    try {
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
      }
    } catch (e) { /* GIS no cargado: no hay nada que desactivar */ }
    if (habia) alCambiar(null, motivo);
  }

  // ── Google Identity Services ──────────────────────────────────────────────

  /**
   * GIS viene de un CDN y **no se puede cachear**: Google lo prohíbe explícitamente y el
   * script se autoactualiza. Es la única dependencia de red del cascarón, y por eso la
   * puerta de acceso es la única pantalla que exige estar en línea.
   */
  function cargarGis() {
    if (gisCargado) return Promise.resolve(true);
    if (window.google && window.google.accounts) { gisCargado = true; return Promise.resolve(true); }

    return new Promise(function (resolver, rechazar) {
      const s = document.createElement('script');
      s.src = GIS;
      s.async = true;
      s.defer = true;
      s.onload = function () { gisCargado = true; resolver(true); };
      s.onerror = function () {
        rechazar(new ErrorSolvo(
          'No pude cargar el inicio de sesión de Google. Necesitas conexión para entrar.',
          { sinRed: true }));
      };
      document.head.appendChild(s);
    });
  }

  function inicializar() {
    google.accounts.id.initialize({
      client_id: window.SOLVO_CONFIG.clientId(),
      callback: function (respuesta) {
        if (!respuesta || !respuesta.credential) return;
        if (guardar(respuesta.credential)) alCambiar(perfil, 'entrada');
      },
      auto_select: true,
      cancel_on_tap_outside: false,
      // Sin esto, GIS puede quedarse esperando FedCM en navegadores donde no está listo.
      use_fedcm_for_prompt: true
    });
  }

  /**
   * Pinta el botón oficial de Google en un contenedor. El aspecto lo controla Google;
   * intentar reimplementarlo rompe sus condiciones de marca y además se desactualiza.
   */
  async function pintarBoton(contenedor) {
    await cargarGis();
    inicializar();
    contenedor.innerHTML = '';
    google.accounts.id.renderButton(contenedor, {
      type: 'standard',
      theme: document.documentElement.dataset.tema === 'oscuro' ? 'filled_black' : 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
      locale: 'es',
      width: Math.min(320, Math.max(220, contenedor.clientWidth || 280))
    });
    // El «One Tap» aparece solo si ya hay una sesión de Google en el navegador. Si no,
    // no hace nada visible, y el botón sigue siendo el camino.
    try { google.accounts.id.prompt(); } catch (e) { /* ignorado a propósito */ }
  }

  /** Renovación sin interfaz. Solo funciona si Google todavía reconoce al usuario. */
  function renovarSilencioso() {
    if (renovando) return renovando;

    renovando = (async function () {
      try {
        await cargarGis();
        inicializar();
      } catch (e) {
        return null;   // sin red: no hay renovación posible, y está bien
      }

      return new Promise(function (resolver) {
        let resuelto = false;
        const acabar = function (v) { if (!resuelto) { resuelto = true; resolver(v); } };

        // GIS no ofrece una promesa: se reengancha el callback y se pone un plazo. Sin el
        // plazo, una renovación que Google decide no atender deja la app colgada.
        google.accounts.id.initialize({
          client_id: window.SOLVO_CONFIG.clientId(),
          callback: function (r) {
            if (r && r.credential && guardar(r.credential)) acabar(r.credential);
            else acabar(null);
          },
          auto_select: true,
          use_fedcm_for_prompt: true
        });
        try {
          google.accounts.id.prompt(function (aviso) {
            if (aviso && aviso.isNotDisplayed && aviso.isNotDisplayed()) acabar(null);
            if (aviso && aviso.isSkippedMoment && aviso.isSkippedMoment()) acabar(null);
          });
        } catch (e) { acabar(null); }

        setTimeout(function () { acabar(null); }, 8000);
      });
    })().finally(function () { renovando = null; });

    return renovando;
  }

  /** Aviso de cambios de sesión: entrada, salida, caducidad. */
  function alCambiarSesion(fn) { alCambiar = fn || function () {}; }

  /**
   * Vigila la caducidad. Sin esto, una pestaña abierta toda la tarde falla en la siguiente
   * acción del usuario en vez de avisar antes.
   */
  function vigilarCaducidad() {
    setInterval(function () {
      if (!perfil) return;
      if (minutosRestantes() <= 0) {
        cerrarSesion('caducada');
      } else if (minutosRestantes() <= window.SOLVO_CONFIG.MINUTOS_MARGEN_TOKEN) {
        renovarSilencioso();
      }
    }, 60000);

    // Al volver a la pestaña, comprobar de inmediato: el temporizador de un minuto se
    // ralentiza en segundo plano y el token puede llevar rato caducado.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible' || !perfil) return;
      if (minutosRestantes() <= 0) cerrarSesion('caducada');
      else if (minutosRestantes() <= window.SOLVO_CONFIG.MINUTOS_MARGEN_TOKEN) renovarSilencioso();
    });
  }

  return {
    tokenValido: tokenValido,
    sesionActiva: sesionActiva,
    perfil: perfilActual,
    pintarBoton: pintarBoton,
    cerrarSesion: cerrarSesion,
    alCambiarSesion: alCambiarSesion,
    vigilarCaducidad: vigilarCaducidad,
    minutosRestantes: minutosRestantes
  };
})();
