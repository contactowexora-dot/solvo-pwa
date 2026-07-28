/**
 * SOLVO — Cascarón de la aplicación.
 * Manual 3 §5.1 (layout) · §10.2 (navegación) · §11.1 (funciones por plataforma)
 * Manual 4 §B (acceso) · Manual 5 §B (medidas)
 *
 * Este archivo es el cascarón y nada más: tema, sesión, enrutado, barra de navegación y
 * estado de red. Cada pantalla llega en su propio paso y se registra en `PANTALLAS`.
 */
const App = (function () {

  // ── Destinos (§6.3) ───────────────────────────────────────────────────────
  const DESTINOS = [
    { id: 'inicio',      titulo: 'Inicio',       icono: 'house' },
    { id: 'movimientos', titulo: 'Movimientos',  icono: 'arrow-left-right' },
    { id: 'dashboard',   titulo: 'Dashboard',    icono: 'layout-dashboard' },
    { id: 'presupuesto', titulo: 'Presupuesto',  icono: 'chart-pie' },
    { id: 'productos',   titulo: 'Productos',    icono: 'wallet' }
  ];

  /** Cada pantalla se registra aquí. En el Paso 9 solo Inicio tiene contenido real. */
  const PANTALLAS = {};

  /**
   * Título de las pantallas que NO son una de las cinco pestañas (§4.1: Objetivos,
   * Patrimonio, Suscripciones, Reportes… viven detrás del menú de perfil, no de la barra).
   * Las pestañas toman su título de `DESTINOS`; esto es solo para las secundarias.
   */
  const TITULOS = {};

  let rutaActual = null;
  let plataforma = { instalada: false, escritorio: false };

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Tres estados, no dos: claro, oscuro y «lo que diga el sistema». Sin el tercero, quien
   * tiene el móvil en automático pierde el cambio de la tarde.
   */
  const Tema = {
    leer: function () { return localStorage.getItem('solvo.tema') || 'auto'; },

    aplicar: function (valor) {
      const v = valor || Tema.leer();
      localStorage.setItem('solvo.tema', v);
      const oscuro = v === 'oscuro' ||
        (v === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
      const cambio = document.documentElement.dataset.tema !== (oscuro ? 'oscuro' : 'claro');
      document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro';
      // La barra del sistema tiene que ir con el tema o queda una franja blanca arriba.
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = oscuro ? '#0B0B0D' : '#F4F4F5';
      // Los gráficos guardan los colores con los que se dibujaron: hay que rehacerlos o el
      // canvas se queda con la paleta anterior mientras el resto de la app ya cambió.
      //
      // `typeof Graficos` y NO `window.Graficos`: en V8 un `const` de nivel superior vive en
      // el ámbito léxico del script y **no es propiedad del objeto global**. Es exactamente
      // la asimetría que dejó las 79 rutas del backend sin resolver en el Paso 3, y aquí
      // hacía que esta línea no se ejecutara nunca, en silencio.
      if (cambio && typeof Graficos !== 'undefined') Graficos.retematizarTodos();
      return oscuro;
    },

    alternar: function () {
      const oscuro = document.documentElement.dataset.tema === 'oscuro';
      Tema.aplicar(oscuro ? 'claro' : 'oscuro');
      pintarCabecera();
    },

    vigilar: function () {
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (Tema.leer() === 'auto') { Tema.aplicar('auto'); pintarCabecera(); }
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PLATAFORMA (§11.1)
  // ═══════════════════════════════════════════════════════════════════════════

  function detectarPlataforma() {
    const instalada = matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone === true;
    const escritorio = matchMedia('(min-width: 1024px)').matches;
    plataforma = { instalada: instalada, escritorio: escritorio };
    document.documentElement.dataset.instalada = String(instalada);
    document.documentElement.dataset.escritorio = String(escritorio);
    return plataforma;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADO DE RED
  // ═══════════════════════════════════════════════════════════════════════════

  function pintarAvisoRed() {
    const zona = document.getElementById('aviso-red');
    if (!zona) return;
    if (navigator.onLine) { zona.innerHTML = ''; return; }
    zona.innerHTML = '<div class="aviso-red">' + UI.ico('cloud-off', 'ico-16') +
                     'Sin conexión · estás viendo lo último que guardé</div>';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PANTALLA DE CONFIGURACIÓN PENDIENTE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Sin los dos valores públicos la app no puede hacer nada. Mostrar una página en blanco
   * sería el peor resultado posible: se ve idéntico a un fallo del servidor.
   */
  function pintarConfiguracion() {
    const origen = location.protocol.startsWith('http') ? location.origin : null;
    document.getElementById('app').innerHTML =
      '<div class="puerta">' +
        '<div class="puerta-marca">' +
          '<div class="puerta-logo">S</div>' +
          '<h1 class="t-display-l">Falta configurar Solvo</h1>' +
          '<p class="t-body txt-2">Dos valores en <code class="t-mono">js/config.js</code>. ' +
            'Los dos son públicos por diseño: viajan en cada petición del navegador.</p>' +
        '</div>' +
        '<div class="tarjeta pila pila-4">' +
          campoConfig('clientId', 'GOOGLE_CLIENT_ID',
            'Google Cloud → Credenciales → tu ID de cliente OAuth.') +
          campoConfig('apiUrl', 'API_URL',
            'Apps Script → Implementar → Nueva implementación → App web → URL.') +
          (origen
            ? '<div class="pila pila-2">' +
                '<p class="t-overline txt-2">Origen autorizado de JavaScript</p>' +
                '<code class="t-mono" style="background:var(--bg-inset);padding:var(--sp-3);' +
                  'border-radius:var(--r-sm);word-break:break-all">' + UI.esc(origen) + '</code>' +
                '<p class="t-caption txt-2">Pega este valor exacto en el mismo ID de cliente, ' +
                  'sin barra final y sin ruta.</p>' +
              '</div>'
            : '<p class="t-caption txt-2">Abre esta página desde su URL de GitHub Pages: ' +
              'con <code class="t-mono">file://</code> no hay origen que autorizar.</p>') +
          '<button class="btn btn-primario btn-bloque pulsable" id="guardar-config">' +
            'Guardar y entrar</button>' +
          '<p class="t-caption txt-3">Guardar aquí lo deja en este navegador para probar. ' +
            'Lo definitivo es editar <code class="t-mono">js/config.js</code> y publicarlo.</p>' +
        '</div>' +
      '</div>';

    document.getElementById('guardar-config').addEventListener('click', function () {
      const id = document.getElementById('cfg-clientId').value.trim();
      const url = document.getElementById('cfg-apiUrl').value.trim();
      if (!id || !url) return UI.avisar('Faltan los dos valores.', { error: true });
      if (!/\.apps\.googleusercontent\.com$/.test(id)) {
        return UI.avisar('El Client ID debe terminar en .apps.googleusercontent.com',
                         { error: true });
      }
      if (!/^https:\/\/script\.google\.com\//.test(url)) {
        return UI.avisar('La API_URL debe empezar por https://script.google.com/',
                         { error: true });
      }
      localStorage.setItem('solvo.clientId', id);
      localStorage.setItem('solvo.apiUrl', url);
      location.reload();
    });
  }

  function campoConfig(clave, etiqueta, ayuda) {
    const valor = localStorage.getItem('solvo.' + clave) || '';
    return '<div class="pila pila-2">' +
             '<label class="t-label" for="cfg-' + clave + '">' + UI.esc(etiqueta) + '</label>' +
             '<input class="t-mono" id="cfg-' + clave + '" value="' + UI.esc(valor) + '" ' +
               'spellcheck="false" autocapitalize="off" style="width:100%;min-height:44px;' +
               'padding:0 var(--sp-3);border-radius:var(--r-sm);border:1px solid var(--border);' +
               'background:var(--bg-inset);color:var(--text-primary)">' +
             '<p class="t-caption txt-2">' + UI.esc(ayuda) + '</p>' +
           '</div>';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUERTA DE ACCESO (Manual 4 §B)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Lo que esta pantalla NO dice: nada sobre listas de correos autorizados. El §B.4 lo pide
   * explícitamente — decir «tu correo no está en la lista» confirma que la lista existe y
   * quién podría estar en ella.
   */
  async function pintarPuerta(error) {
    document.getElementById('app').innerHTML =
      '<div class="puerta">' +
        '<div class="puerta-marca">' +
          '<div class="puerta-logo">S</div>' +
          '<h1 class="t-display-xl">Solvo</h1>' +
          '<p class="t-body txt-2">Tus finanzas personales, resueltas.</p>' +
        '</div>' +
        '<div class="puerta-acciones">' +
          (error ? '<div class="puerta-error">' + UI.ico('triangle-alert', 'ico-16') +
                   '<span>' + UI.esc(error) + '</span></div>' : '') +
          '<div class="puerta-gis" id="gis"></div>' +
          '<p class="t-caption txt-2" style="text-align:center">' +
            'Entra con la cuenta de Google con la que usas Solvo.</p>' +
        '</div>' +
      '</div>';

    try {
      await Auth.pintarBoton(document.getElementById('gis'));
    } catch (e) {
      // Sin red no hay inicio de sesión posible: es la única pantalla que la exige.
      document.getElementById('gis').innerHTML =
        '<div class="puerta-error">' + UI.ico('cloud-off', 'ico-16') +
        '<span>' + UI.esc(e.message) + '</span></div>';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CASCARÓN
  // ═══════════════════════════════════════════════════════════════════════════

  function pintarCascaron() {
    // El cascarón se repinta al volver a entrar: el observador anterior apunta a nodos
    // que ya no están en el documento y nunca volvería a dispararse.
    if (observador) { observador.disconnect(); observador = null; }

    document.getElementById('app').innerHTML =
      '<div class="app">' +
        '<header class="cabecera" id="cabecera"></header>' +
        '<div id="aviso-red"></div>' +
        '<main class="contenido" id="contenido" tabindex="-1"></main>' +
        '<nav class="barra-nav" id="barra-nav" data-listo="false" aria-label="Secciones">' +
          '<span class="nav-pildora" id="nav-pildora"></span>' +
          DESTINOS.map(function (d) {
            return '<button class="nav-item pulsable" data-ruta="' + d.id + '" ' +
                     'aria-label="' + UI.esc(d.titulo) + '">' +
                     UI.ico(d.icono) +
                     '<span class="nav-item-texto">' + UI.esc(d.titulo) + '</span>' +
                   '</button>';
          }).join('') +
        '</nav>' +
        '<button class="fab pulsable" id="fab" aria-label="Registrar movimiento">' +
          UI.ico('plus', 'ico-24') +
        '</button>' +
      '</div>';

    document.getElementById('barra-nav').addEventListener('click', function (e) {
      const b = e.target.closest('[data-ruta]');
      if (b) ir(b.dataset.ruta);
    });
    document.getElementById('fab').addEventListener('click', abrirRegistrar);

    vigilarScrollCabecera();
    pintarAvisoRed();
  }

  /** Acciones pendientes. La campana solo existe si hay alguna (§8.1). */
  let nAcciones = 0;

  function marcarAcciones(n) {
    const previo = nAcciones;
    nAcciones = Number(n) || 0;
    if (previo !== nAcciones) pintarCabecera();
  }

  function pintarCabecera() {
    const cab = document.getElementById('cabecera');
    if (!cab) return;
    const destino = DESTINOS.filter(function (d) { return d.id === rutaActual; })[0];
    const oscuro = document.documentElement.dataset.tema === 'oscuro';
    const p = Auth.perfil();
    const titulo = destino ? destino.titulo : (TITULOS[rutaActual] || 'Solvo');

    cab.innerHTML =
      // Las pantallas secundarias (fuera de las cinco pestañas) no tienen un destino en la
      // barra al que volver con un toque, así que llevan flecha de retroceso. Las pestañas
      // no la necesitan: para eso está la barra de navegación.
      (!destino
        ? '<button class="btn-icono pulsable" data-al="atras" aria-label="Volver">' +
            UI.ico('arrow-left') + '</button>'
        : '') +
      '<h1 class="cabecera-titulo crece recorta">' + UI.esc(titulo) + '</h1>' +
      '<button class="btn-icono pulsable" data-al="tema" ' +
        'aria-label="' + (oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro') + '">' +
        UI.ico(oscuro ? 'sun' : 'moon') + '</button>' +
      // §8.1: el banner del Centro de Acciones se elimina; queda solo la campana, y
      // **únicamente cuando hay acciones pendientes**. Sin ellas no se renderiza: un icono
      // permanente que casi nunca lleva a nada acaba siendo invisible.
      (nAcciones > 0
        ? '<button class="btn-icono pulsable campana" data-al="acciones" ' +
            'aria-label="' + nAcciones + ' acciones pendientes">' + UI.ico('bell') +
            '<span class="badge">' + (nAcciones > 9 ? '9+' : nAcciones) + '</span>' +
          '</button>'
        : '') +
      '<button class="btn-icono pulsable" data-al="cuenta" ' +
        'aria-label="Tu cuenta' + (p ? ': ' + UI.esc(p.correo) : '') + '">' +
        UI.ico('user') + '</button>';

    cab.onclick = function (e) {
      const b = e.target.closest('[data-al]');
      if (!b) return;
      if (b.dataset.al === 'tema') Tema.alternar();
      if (b.dataset.al === 'acciones') abrirAcciones();
      if (b.dataset.al === 'cuenta') abrirCuenta();
      if (b.dataset.al === 'atras') history.back();
    };
  }

  /**
   * El header colapsa de 56 a 44 al bajar (§5.1). Con histéresis: sin ella, un scroll a
   * 120px hace que el header salte entre los dos tamaños en cada pixel.
   */
  function vigilarScrollCabecera() {
    const cab = document.getElementById('cabecera');
    let compacta = false;
    let pendiente = false;

    addEventListener('scroll', function () {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () {
        pendiente = false;
        const y = scrollY;
        if (!compacta && y > 24) { compacta = true; cab.dataset.compacta = 'true'; }
        else if (compacta && y < 8) { compacta = false; cab.dataset.compacta = 'false'; }
      });
    }, { passive: true });
  }

  /**
   * La píldora se mide del botón activo y se mueve. Es UN elemento que se desplaza, no cinco
   * que se encienden: el desplazamiento se lee como continuidad, no como parpadeo (§10.2).
   *
   * Dos cosas que costaron un rato entender:
   *
   * 1. Se usa `offsetLeft`/`offsetWidth`, no `getBoundingClientRect()`. La píldora está
   *    posicionada respecto a la CAJA DE RELLENO de la barra, así que restar rectángulos de
   *    viewport se desvía por el relleno y —solo en tema oscuro, que añade borde— por un
   *    píxel más. Con `offsetLeft` ambos elementos comparten el mismo origen y la resta es
   *    exacta en los dos temas.
   *
   * 2. NO se depende de `requestAnimationFrame` para colocarla. rAF no se ejecuta mientras
   *    la pestaña no compone fotogramas: en una pestaña de segundo plano la píldora se
   *    quedaba con ancho cero y sin desplazar. Se coloca de forma síncrona y se recoloca
   *    cuando el texto del destino activo termina de interpolar su ancho.
   */
  let observador = null;

  function moverPildora() {
    const barra = document.getElementById('barra-nav');
    const pildora = document.getElementById('nav-pildora');
    const activo = barra && barra.querySelector('[aria-current="page"]');
    if (!barra || !pildora || !activo) return;

    pildora.style.width = activo.offsetWidth + 'px';
    pildora.style.transform = 'translateX(' + (activo.offsetLeft - pildora.offsetLeft) + 'px)';
    barra.dataset.listo = 'true';

    // El ancho del destino activo crece durante --d-panel (el label se despliega). La
    // primera medida es la del icono solo; al acabar la transición se vuelve a medir y la
    // píldora acompaña al texto en vez de quedarse corta.
    const texto = activo.querySelector('.nav-item-texto');
    if (texto) {
      texto.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'max-width') moverPildora();
      }, { once: true });
    }

    // ResizeObserver y no el evento `resize` de la ventana: el ancho del ítem activo cambia
    // en situaciones que NO disparan resize —cuando llegan las fuentes web y el label pasa
    // de la métrica de respaldo a la de Inter, o cuando cambia el margen seguro al girar el
    // teléfono— y con `resize` la píldora se quedaba con el ancho del render anterior.
    if (!observador && 'ResizeObserver' in window) {
      let ultimo = '';
      observador = new ResizeObserver(function () {
        const act = barra.querySelector('[aria-current="page"]');
        if (!act) return;
        const firma = act.offsetLeft + ':' + act.offsetWidth;
        if (firma === ultimo) return;   // evita el bucle: recolocar cambia tamaños
        ultimo = firma;
        pildora.style.width = act.offsetWidth + 'px';
        pildora.style.transform = 'translateX(' + (act.offsetLeft - pildora.offsetLeft) + 'px)';
      });
      observador.observe(barra);
      DESTINOS.forEach(function (d) {
        const b = barra.querySelector('[data-ruta="' + d.id + '"]');
        if (b) observador.observe(b);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENRUTADO
  // ═══════════════════════════════════════════════════════════════════════════

  function ir(ruta) {
    if (ruta === rutaActual) {
      // Volver a pulsar el destino activo sube al inicio. Es el gesto que todo el mundo
      // prueba y casi nadie implementa.
      scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    location.hash = '#/' + ruta;
  }

  async function resolverHash() {
    const cruda = (location.hash || '').replace(/^#\/?/, '');
    // Válida si es una de las cinco pestañas O una pantalla secundaria ya registrada
    // (Objetivos y las que lleguen detrás del menú de perfil, §4.1). Solo una ruta
    // verdaderamente desconocida cae a Inicio.
    const conocida = DESTINOS.some(function (d) { return d.id === cruda; }) || !!PANTALLAS[cruda];
    const ruta = conocida ? cruda : 'inicio';
    if (ruta !== cruda) { location.replace('#/' + ruta); return; }

    // El índice solo existe para las cinco pestañas: una pantalla secundaria da -1 en las
    // dos comparaciones, y `atras` se queda en `false` — entra como una pantalla nueva, ni
    // «hacia atrás» ni «hacia adelante» dentro de la barra, que es lo correcto para algo que
    // no vive en ella.
    const idxNueva = DESTINOS.findIndex(function (d) { return d.id === ruta; });
    const idxVieja = DESTINOS.findIndex(function (d) { return d.id === rutaActual; });
    const atras = idxNueva >= 0 && idxVieja >= 0 && idxNueva < idxVieja;
    rutaActual = ruta;

    // La píldora y el `aria-current` de la barra solo se tocan cuando la ruta nueva es una
    // pestaña: entrar a una pantalla secundaria no debe apagar la pestaña desde la que se
    // llegó, porque a esa es donde «Volver» va a devolver a la persona.
    if (DESTINOS.some(function (d) { return d.id === ruta; })) {
      document.querySelectorAll('.nav-item').forEach(function (b) {
        if (b.dataset.ruta === ruta) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      moverPildora();
    }
    pintarCabecera();

    // ECharts retiene el canvas y sus escuchas. En una app de una sola página que repinta al
    // navegar, no soltarlos son fugas que se acumulan hasta que el móvil va a tirones.
    if (typeof Graficos !== 'undefined') Graficos.destruirTodos();

    const cont = document.getElementById('contenido');
    cont.innerHTML = '<div class="vista contenedor pila pila-3"' +
                     (atras ? ' data-atras="true"' : '') + '></div>';
    const vista = cont.firstElementChild;
    scrollTo({ top: 0 });
    // Anunciar el cambio a lectores de pantalla: sin esto, navegar no dice nada.
    cont.focus({ preventScroll: true });

    const pintar = PANTALLAS[ruta];
    if (!pintar) { vista.innerHTML = marcadorDePaso(ruta); return; }

    try {
      await pintar(vista);
    } catch (e) {
      if (e && e.cancelada) return;
      if (e && (e.sesion || e.sinAcceso)) { Auth.cerrarSesion('rechazada'); return; }
      vista.innerHTML = UI.vacio({
        icono: e.sinRed ? 'cloud-off' : 'circle-alert',
        titulo: e.sinRed ? 'Sin conexión' : 'No pude cargar esta pantalla',
        texto: e.message
      });
      vista.querySelector('.vacio').insertAdjacentHTML('beforeend',
        '<button class="btn btn-secundario pulsable" id="reintentar">Reintentar</button>');
      vista.querySelector('#reintentar').addEventListener('click', resolverHash);

      // Cuando el fallo apunta al despliegue, el dato que falta para diagnosticarlo es a
      // QUÉ URL se está llamando. Sin verla, la única salida es adivinar.
      if (e.despliegue) vista.insertAdjacentHTML('beforeend',
        panelDiagnostico(e.url, e.interno));
    }
  }

  /**
   * Qué comprobar cuando el navegador no puede hablar con el backend. Se enseña la URL
   * completa —es pública por diseño— y un enlace para abrirla: si al abrirla sale el JSON
   * con «Inicia sesión para continuar», la URL es correcta y el problema es el acceso del
   * despliegue.
   */
  function panelDiagnostico(url, interno) {
    const u = String(url || window.SOLVO_CONFIG.apiUrl());
    const esExec = /\/exec$/.test(u);
    const esDev = /\/dev$/.test(u);

    return '<section class="tarjeta tarjeta-plana pila pila-3" style="margin-top:var(--sp-4)">' +
      '<h3 class="t-overline txt-2">Qué comprobar</h3>' +
      '<code class="t-mono" style="background:var(--bg-inset);padding:var(--sp-3);' +
        'border-radius:var(--r-sm);word-break:break-all">' + UI.esc(u) + '</code>' +
      (esDev
        ? '<p class="t-label warn">Esa URL acaba en <b>/dev</b>. La de pruebas exige tu sesión ' +
          'de Google y nunca funciona desde la app: usa la que acaba en <b>/exec</b>.</p>'
        : '') +
      (!esExec && !esDev
        ? '<p class="t-label warn">Esa URL no acaba en <b>/exec</b>. No es la de un ' +
          'despliegue web.</p>'
        : '') +
      '<ol class="pila pila-2 t-label txt-2" style="padding-left:var(--sp-5);' +
        'list-style:decimal">' +
        '<li>Ábrela en otra pestaña. Debe responder ' +
          '<code class="t-mono">{"ok":false,"error":"Inicia sesión para continuar."}</code></li>' +
        '<li>Si responde <code class="t-mono">NO</code>, es la URL del Guardián, no la del ' +
          'backend. Esa nunca va aquí.</li>' +
        '<li>Si te pide iniciar sesión de Google, el despliegue está como «Solo yo». ' +
          'Vuelve a publicarlo con <b>Cualquier persona</b>.</li>' +
      '</ol>' +
      '<p class="t-caption txt-3">Que la URL te funcione al abrirla <b>no</b> prueba que sea ' +
        'pública: tu navegador va con tu sesión, y la app no. Ábrela en una ventana de ' +
        'incógnito — ahí no hay sesión, igual que en la app.</p>' +
      (interno ? '<p class="t-caption txt-3">Error interno del navegador: <code ' +
                 'class="t-mono">' + UI.esc(interno) + '</code></p>' : '') +
      '<a class="btn btn-secundario pulsable" href="' + UI.esc(u) + '" target="_blank" ' +
        'rel="noopener">Abrir la URL' + UI.ico('chevron-right', 'ico-16') + '</a>' +
    '</section>';
  }

  /** Las pantallas que aún no existen dicen en qué paso llegan, no «404». */
  function marcadorDePaso(ruta) {
    const cuando = {
      presupuesto: 'Paso 15'
    }[ruta] || 'un paso próximo';
    return UI.vacio({
      icono: 'sparkles',
      titulo: 'Esta pantalla llega en el ' + cuando,
      texto: 'El cascarón, el acceso y la conexión con tus datos ya funcionan.'
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOJAS DEL CASCARÓN
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * El FAB abre las tres puertas del §7: gasto, ingreso y mover dinero. Son tres cosas
   * distintas y contablemente incompatibles, así que se eligen antes de escribir nada — no
   * hay un formulario único con un desplegable de tipo arriba.
   */
  function abrirRegistrar() {
    const opciones = [
      { tipo: 'gasto', texto: 'Gasto', icono: 'arrow-up-right', color: 'var(--cat-rojo)',
        desc: 'Dinero que sale' },
      { tipo: 'ingreso', texto: 'Ingreso', icono: 'arrow-down-left', color: 'var(--cat-verde)',
        desc: 'Dinero que entra' },
      { tipo: 'mover', texto: 'Mover dinero', icono: 'arrow-left-right',
        color: 'var(--cat-indigo)', desc: 'Cambia de sitio, ni entra ni sale' }
    ];

    const hoja = UI.abrirHoja({
      titulo: 'Registrar',
      html: '<ul class="pila pila-2">' + opciones.map(function (o) {
        return '<li><button type="button" class="fila pulsable fila-opcion" ' +
          'data-registrar="' + o.tipo + '">' +
          '<span class="ico-cat" style="--color-cat:' + o.color + '">' +
            UI.ico(o.icono) + '</span>' +
          '<span class="crece pila" style="text-align:left">' +
            '<span class="t-card-title">' + o.texto + '</span>' +
            '<span class="t-caption txt-2">' + o.desc + '</span>' +
          '</span>' + UI.ico('chevron-right') +
        '</button></li>';
      }).join('') + '</ul>',
      alAbrir: function (raiz) {
        raiz.addEventListener('click', async function (e) {
          const b = e.target.closest('[data-registrar]');
          if (!b) return;
          hoja.cerrar();
          await registrar(b.dataset.registrar);
        });
      }
    });
  }

  /**
   * Los catálogos se piden ANTES de pintar el formulario. Abrirlo vacío y rellenarlo después
   * enseñaría medio segundo de selectores en blanco, y quien toque uno en ese instante
   * abriría una hoja sin opciones.
   */
  const FORMULARIOS = { gasto: 1, ingreso: 1, mover: 1, cuenta: 1, tarjeta: 1,
    prestamo: 1, inversion: 1, objetivo: 1 };

  async function registrar(tipo, prellenado) {
    // Un tipo desconocido se queda callado si no se comprueba: eso fue exactamente lo que
    // pasó cuando esta función acabó ocupando el nombre `App.registrar` y recibía nombres de
    // pantalla en vez de tipos de formulario. Un error visible cuesta un segundo; uno mudo,
    // media hora.
    if (!FORMULARIOS[tipo]) {
      throw new Error('Tipo de formulario desconocido: «' + tipo + '».');
    }

    const cerrarAviso = UI.avisar('Preparando…', { ms: 8000 });
    try {
      await Formularios.cargarCatalogos();
      cerrarAviso();
      if (tipo === 'gasto') return formularioGasto(prellenado);
      if (tipo === 'ingreso') return formularioIngreso(prellenado);
      if (tipo === 'mover') return formularioMover(prellenado);
      // `prellenado` hace doble uso aquí: para gasto/ingreso/mover es el pendiente de
      // importación (§9.3); para los productos y objetivos es la fila de `detalle` cuando
      // se está EDITANDO. Mismo hueco del argumento, mismo propósito de fondo — precargar
      // un formulario que si no empezaría vacío.
      if (tipo === 'cuenta') return formularioCuenta(prellenado);
      if (tipo === 'tarjeta') return formularioTarjeta(prellenado);
      if (tipo === 'prestamo') return formularioPrestamo(prellenado);
      if (tipo === 'inversion') return formularioInversion(prellenado);
      if (tipo === 'objetivo') return formularioObjetivo(prellenado);
    } catch (e) {
      cerrarAviso();
      if (e && (e.sesion || e.sinAcceso)) return Auth.cerrarSesion('rechazada');
      UI.avisarError(e);
    }
  }

  function abrirAcciones() {
    UI.abrirHoja({
      titulo: 'Centro de Acciones',
      html: UI.vacio({
        icono: 'circle-check',
        titulo: 'Todo al día',
        texto: 'La lista real se conecta en el Paso 11.'
      })
    });
  }

  function abrirCuenta() {
    const p = Auth.perfil();
    const tema = Tema.leer();
    const min = Math.max(0, Math.round(Auth.minutosRestantes()));

    const hoja = UI.abrirHoja({
      titulo: 'Tu cuenta',
      html:
        '<div class="fila" style="margin-bottom:var(--sp-5)">' +
          (p && p.foto
            ? '<img src="' + UI.esc(p.foto) + '" alt="" width="44" height="44" ' +
              'referrerpolicy="no-referrer" style="border-radius:999px">'
            : '<div class="ico-cat" style="--color-cat:var(--cat-indigo)">' +
              UI.ico('user', 'ico-24') + '</div>') +
          '<div class="crece pila">' +
            '<span class="t-card-title recorta">' + UI.esc((p && p.nombre) || 'Sesión activa') +
            '</span>' +
            '<span class="t-caption txt-2 recorta">' + UI.esc((p && p.correo) || '') + '</span>' +
          '</div>' +
        '</div>' +

        // Suscripciones, Patrimonio, Reportes, Administrar y Configuración llegan con el
        // Paso 16 (Manual 1 §4.1: viven aquí, detrás del menú de perfil). Objetivos ya está.
        '<button type="button" class="fila pulsable fila-opcion" data-al="objetivos" ' +
          'style="margin-bottom:var(--sp-5)">' +
          '<span class="ico-cat ico-cat-sm" style="--color-cat:var(--cat-indigo)">' +
            UI.ico('target') + '</span>' +
          '<span class="crece t-card-title" style="text-align:left">Objetivos</span>' +
          UI.ico('chevron-right') +
        '</button>' +

        '<p class="t-overline txt-2" style="margin-bottom:var(--sp-2)">Tema</p>' +
        '<div class="fila" style="margin-bottom:var(--sp-5)">' +
          [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(function (o) {
            return '<button class="chip pulsable" data-tema="' + o[0] + '" aria-pressed="' +
                   (tema === o[0]) + '">' + o[1] + '</button>';
          }).join('') +
        '</div>' +

        '<div class="tarjeta tarjeta-plana pila pila-2" style="margin-bottom:var(--sp-5)">' +
          '<div class="fila-entre"><span class="t-label txt-2">Sesión</span>' +
            '<span class="t-label">' + min + ' min restantes</span></div>' +
          '<div class="fila-entre"><span class="t-label txt-2">Modo</span>' +
            '<span class="t-label">' + (plataforma.instalada ? 'Instalada' : 'Navegador') +
            '</span></div>' +
          '<div class="fila-entre"><span class="t-label txt-2">Versión</span>' +
            '<span class="t-mono">' + UI.esc(window.SOLVO_CONFIG.VERSION) + '</span></div>' +
        '</div>' +

        '<button class="btn btn-secundario btn-bloque pulsable" data-al="salir">' +
          UI.ico('log-out', 'ico-16') + 'Cerrar sesión</button>'
    });

    hoja.el.addEventListener('click', function (e) {
      // `closest('[data-tema]')` a secas sube hasta <html>, que también lleva ese
      // atributo (es la marca global de tema, Tema.aplicar). Sin acotar al chip real,
      // ESE match siempre gana primero y ningún otro botón de la hoja llega a ejecutarse.
      const t = e.target.closest('.chip[data-tema]');
      if (t) {
        Tema.aplicar(t.dataset.tema);
        pintarCabecera();
        hoja.el.querySelectorAll('[data-tema]').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.dataset.tema === t.dataset.tema));
        });
        return;
      }
      if (e.target.closest('[data-al="salir"]')) {
        hoja.cerrar();
        Auth.cerrarSesion('manual');
        return;
      }
      if (e.target.closest('[data-al="objetivos"]')) {
        hoja.cerrar();
        ir('objetivos');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ARRANQUE
  // ═══════════════════════════════════════════════════════════════════════════

  function alCambiarSesion(nuevoPerfil, motivo) {
    if (nuevoPerfil) { arrancarSesion(); return; }

    const mensajes = {
      caducada: 'Tu sesión caducó. Vuelve a entrar.',
      rechazada: 'Esta cuenta no puede entrar a Solvo.',
      manual: null
    };
    pintarPuerta(mensajes[motivo] || null);
  }

  function arrancarSesion() {
    pintarCascaron();
    addEventListener('hashchange', resolverHash);
    resolverHash();
  }

  async function iniciar() {
    Tema.aplicar();
    Tema.vigilar();
    detectarPlataforma();
    matchMedia('(min-width: 1024px)').addEventListener('change', function () {
      detectarPlataforma();
      moverPildora();
    });
    // La reposición fina la lleva el ResizeObserver de moverPildora; esto solo cubre el
    // caso de que el navegador no lo tenga.
    if (!('ResizeObserver' in window)) addEventListener('resize', moverPildora);
    addEventListener('online', function () { pintarAvisoRed(); resolverHash(); });
    addEventListener('offline', pintarAvisoRed);

    Auth.alCambiarSesion(alCambiarSesion);
    Auth.vigilarCaducidad();
    registrarServiceWorker();

    if (!window.SOLVO_CONFIG.completa()) { pintarConfiguracion(); return; }
    if (Auth.sesionActiva()) arrancarSesion();
    else await pintarPuerta();
  }

  /**
   * El Service Worker sirve el cascarón desde caché, así que un despliegue nuevo NO se ve
   * al recargar: se ve a la siguiente. Es el comportamiento normal de una PWA y también la
   * forma más fácil de perder media hora persiguiendo un arreglo que ya estaba publicado.
   *
   * Con `updateViaCache: 'none'` el propio sw.js nunca se sirve de caché, así que la versión
   * nueva se detecta en la primera visita; y cuando está lista se le ofrece al usuario en vez
   * de recargarle la pantalla debajo de las manos.
   */
  function registrarServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Con file:// el registro lanza una excepción que oscurece cualquier otro error.
    if (!location.protocol.startsWith('http')) return;
    // Escotilla para desarrollo: la caché del cascarón sirve los archivos viejos y hace
    // perder un rato largo persiguiendo un arreglo que ya estaba escrito.
    if (localStorage.getItem('solvo.sinSW') === '1') return;

    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then(function (reg) {
        reg.addEventListener('updatefound', function () {
          const nuevo = reg.installing;
          if (!nuevo) return;
          nuevo.addEventListener('statechange', function () {
            // `controller` existente significa que ya había una versión: es una
            // actualización, no la primera instalación.
            if (nuevo.state !== 'installed' || !navigator.serviceWorker.controller) return;
            UI.avisar('Hay una versión nueva de Solvo.', {
              ms: 12000,
              accion: {
                texto: 'Actualizar',
                al: function () { nuevo.postMessage('activar-ya'); }
              }
            });
          });
        });
      })
      .catch(function (e) {
        console.warn('Service Worker no registrado:', e && e.message);
      });

    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (recargando) return;   // Chrome puede emitirlo dos veces
      recargando = true;
      location.reload();
    });
  }

  return {
    iniciar: iniciar,
    ir: ir,
    recargar: resolverHash,
    // Ojo con los nombres: aquí hubo dos claves `registrar` en el mismo objeto —una para
    // registrar pantallas y otra para abrir el formulario de registro— y la segunda ganaba
    // en silencio, dejando el registro de pantallas sin efecto. JavaScript no avisa de una
    // clave duplicada en un literal: se queda con la última y sigue.
    registrar: function (ruta, pintar, titulo) {
      PANTALLAS[ruta] = pintar;
      if (titulo) TITULOS[ruta] = titulo;
    },
    marcarAcciones: marcarAcciones,
    abrirFormulario: registrar,
    plataforma: function () { return plataforma; },
    Tema: Tema
  };
})();

document.addEventListener('DOMContentLoaded', App.iniciar);
