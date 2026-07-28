/**
 * SOLVO — Pantalla Objetivos. Manual 1 §8.6.
 *
 * Responde a «¿cuánto llevo ahorrado, cuánto me falta y cuándo llego?». Pantalla
 * secundaria (no vive en la barra de pestañas): se llega desde la tarjeta resumen de
 * Productos o desde el menú de perfil (§4.1). El enrutado que la hace posible está en
 * `app.js` — ver el §1.D de `TRASPASO.md`.
 *
 * Tres divisiones —Activas, Pausadas, Alcanzadas— pero **una sola llamada**:
 * `objetivos.listar()` sin `estado` ya devuelve las tres listas de una vez. Cambiar de
 * división aquí es solo repintar con el array que ya está en memoria, no un nuevo viaje
 * a la API — al revés que los chips de Movimientos, que sí cambian filtros del servidor.
 *
 * El gesto de deslizar es el mismo lenguaje del §10.4 (revela, no ejecuta), adaptado de
 * `movimientos.js` a una tarjeta completa en vez de una fila delgada: la acción de la
 * izquierda cambia según la división (Pausar / Despausar / Editar), la de la derecha es
 * siempre Eliminar.
 *
 * Todo el archivo vive en un IIFE por la misma razón que las demás pantallas.
 */
(function () {

const Obj = (function () {
  const est = { division: 'ACTIVO', datos: null };
  return { est: est };
})();

App.registrar('objetivos', async function (vista) {
  vista.innerHTML = esqueleto();
  const d = await Api.llamar('objetivos.listar', {}, { clave: 'objetivos' });
  Obj.est.datos = d;
  pintar(vista);
  conectar(vista);
}, 'Objetivos');

// ═══════════════════════════════════════════════════════════════════════════════
// PINTADO
// ═══════════════════════════════════════════════════════════════════════════════

function pintar(vista) {
  const d = Obj.est.datos;
  const m = Formularios.catalogos().config.moneda_base;
  const total = d.conteos.activas + d.conteos.pausadas + d.conteos.alcanzadas;

  if (total === 0) { pintarVacio(vista); return; }

  vista.innerHTML = filaAgregar() + heroTotal(d, m) + segmentadoDivisiones(d) + listaCards(d, m);
  escalonar(vista);
}

function filaAgregar() {
  return '<div class="fila-entre" style="margin-bottom:var(--sp-1)">' +
    '<span class="t-overline txt-2">Tus objetivos</span>' +
    '<button class="btn-icono pulsable" data-al="agregar" aria-label="Agregar objetivo">' +
      UI.ico('plus') + '</button>' +
  '</div>';
}

function heroTotal(d, m) {
  return '<section class="tarjeta hero-patrimonio">' +
    '<span class="t-overline txt-2">Total ahorrado</span>' +
    '<div class="fila" style="align-items:baseline;gap:var(--sp-2);margin-top:var(--sp-1)">' +
      '<span class="t-display-xl num">' +
        UI.monto(d.total_ahorrado, m, { sinSigno: true, sinDecimales: true }) + '</span>' +
    '</div>' +
    '<span class="t-caption txt-2">de ' + UI.monto(d.total_meta, m, { sinSigno: true }) +
      ' en metas' +
      (d.aporte_mensual_comprometido > 0
        ? ' · ' + UI.monto(d.aporte_mensual_comprometido, m, { sinSigno: true }) +
          '/mes comprometidos'
        : '') +
    '</span>' +
  '</section>';
}

const DIVISIONES = [
  ['ACTIVO', 'Activas', 'activas'], ['PAUSADO', 'Pausadas', 'pausadas'],
  ['ALCANZADO', 'Alcanzadas', 'alcanzadas']
];

function segmentadoDivisiones(d) {
  return '<div class="segmentado" data-divisiones style="margin:var(--sp-4) 0">' +
    DIVISIONES.map(function (x) {
      const n = d.conteos[x[2]];
      return '<button type="button" class="segmento pulsable" data-division="' + x[0] +
        '" aria-checked="' + (Obj.est.division === x[0]) + '">' + x[1] + ' ' + n + '</button>';
    }).join('') + '</div>';
}

function listaCards(d, m) {
  const clave = { ACTIVO: 'activas', PAUSADO: 'pausadas', ALCANZADO: 'alcanzadas' }[Obj.est.division];
  const items = d[clave] || [];
  if (!items.length) return seccionVaciaDivision(Obj.est.division);
  return '<div class="pila pila-3" data-lista>' +
    items.map(function (o) { return tarjetaObjetivo(o, m); }).join('') + '</div>';
}

function seccionVaciaDivision(division) {
  const texto = {
    ACTIVO: 'Ponle nombre a tu próxima meta.',
    PAUSADO: 'No tienes objetivos pausados.',
    ALCANZADO: 'Todavía no alcanzaste ninguna meta — ¡vas en camino!'
  }[division];
  return '<div class="tarjeta tarjeta-plana" style="text-align:center;padding:var(--sp-6)">' +
    '<p class="t-body txt-2">' + UI.esc(texto) + '</p></div>';
}

/** §8.6: ícono, `ahorrado de meta`, %, barra, aporte sugerido y fecha estimada. En
 *  Alcanzadas la barra va completa con un check y la fecha en la que se alcanzó. */
function tarjetaObjetivo(o, m) {
  const alcanzado = o.estado === 'ALCANZADO';
  const pct = Math.round(o.porcentaje * 100);
  const accionIzq = { ACTIVO: ['pause', 'Pausar', 'pausar'],
                      PAUSADO: ['play', 'Despausar', 'despausar'],
                      ALCANZADO: ['pencil', 'Editar', 'editar'] }[o.estado];

  return '<div class="obj-card" data-obj="' + UI.esc(o.id_objetivo) + '">' +
    '<div class="obj-acciones">' +
      '<button class="obj-accion obj-accion-izq pulsable" data-accion="' + accionIzq[2] + '">' +
        UI.ico(accionIzq[0], 'ico-16') + accionIzq[1] + '</button>' +
      '<button class="obj-accion obj-accion-der pulsable" data-accion="eliminar">' +
        UI.ico('trash-2', 'ico-16') + 'Eliminar</button>' +
    '</div>' +
    '<button class="obj-carril tarjeta pulsable" style="width:100%;text-align:left">' +
      '<div class="fila">' +
        '<span class="ico-cat" style="--color-cat:' + UI.esc(o.color_icono) + '">' +
          UI.ico(o.icono) + '</span>' +
        '<span class="crece pila" style="gap:2px">' +
          '<span class="t-card-title recorta">' + UI.esc(o.nombre) + '</span>' +
          '<span class="t-caption txt-2">' +
            UI.monto(o.ahorrado, m, { sinSigno: true }) + ' de ' +
            UI.monto(o.monto_meta, m, { sinSigno: true }) + '</span>' +
        '</span>' +
        (alcanzado
          ? '<span class="ico-cat ico-cat-sm" style="--color-cat:var(--positive)">' +
            UI.ico('circle-check') + '</span>'
          : '<span class="t-title num">' + pct + '%</span>') +
      '</div>' +
      '<div class="pista-progreso" style="margin-top:var(--sp-3)">' +
        '<div class="relleno-progreso" style="width:' + (alcanzado ? 100 : pct) +
          '%;background:' + (alcanzado ? 'var(--positive)' : 'var(--accent)') + '"></div>' +
      '</div>' +
      (alcanzado
        ? '<span class="t-caption txt-2" style="margin-top:var(--sp-2)">Alcanzada el ' +
          UI.esc(fechaCortaObj(o.fecha_alcanzado)) + '</span>'
        : '<div class="fila-entre" style="margin-top:var(--sp-2)">' +
            '<span class="t-caption txt-2">' +
              (o.aporte_mensual_sugerido > 0
                ? UI.monto(o.aporte_mensual_sugerido, m, { sinSigno: true }) + '/mes sugerido'
                : 'Meta cubierta') +
            '</span>' +
            (o.fecha_estimada_al_ritmo
              ? '<span class="t-caption ' + (o.en_ritmo ? 'txt-2' : 'warn') + '">' +
                (o.en_ritmo ? '' : '~') + 'Llegas ' + UI.esc(fechaCortaObj(o.fecha_estimada_al_ritmo)) +
                '</span>'
              : '') +
          '</div>') +
    '</button>' +
  '</div>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

function conectar(vista) {
  vista.addEventListener('click', async function (e) {
    if (e.target.closest('[data-al="agregar"]')) {
      return abrirYRecargar(function () { return App.abrirFormulario('objetivo'); });
    }

    const seg = e.target.closest('[data-division]');
    if (seg) {
      if (Obj.est.division === seg.dataset.division) return;
      Obj.est.division = seg.dataset.division;
      pintar(vista);
      conectarListaSolamente(vista);
      return;
    }

    const accion = e.target.closest('[data-accion]');
    if (accion) {
      const card = accion.closest('[data-obj]');
      return manejarAccion(accion.dataset.accion, card.dataset.obj, card);
    }

    const carril = e.target.closest('.obj-carril');
    if (carril) {
      const card = carril.closest('.obj-card');
      if (card.dataset.abierta) return cerrarCard(card);
      return abrirDetalle(card.dataset.obj);
    }
  });

  gestoDeslizarObjetivo(vista);
}

/** Tras cambiar de división el listado es nuevo DOM: el gesto se reengancha sobre él. */
function conectarListaSolamente(vista) { gestoDeslizarObjetivo(vista); }

function objetivoPorId(id) {
  const d = Obj.est.datos;
  return (d.activas || []).concat(d.pausadas || [], d.alcanzadas || [])
    .filter(function (o) { return o.id_objetivo === id; })[0] || null;
}

async function manejarAccion(accion, id, card) {
  const o = objetivoPorId(id);
  if (!o) return;

  if (accion === 'editar') {
    cerrarCard(card);
    return abrirYRecargar(function () { return App.abrirFormulario('objetivo', o); });
  }
  if (accion === 'pausar') return confirmarCambioEstado(card, o, 'pausar', 'Pausar objetivo',
    '«' + o.nombre + '» pasará a Pausadas. Puedes despausarlo cuando quieras.');
  if (accion === 'despausar') return confirmarCambioEstado(card, o, 'despausar',
    'Despausar objetivo', '«' + o.nombre + '» vuelve a Activas.');
  if (accion === 'eliminar') return eliminarObjetivo(o, function () { cerrarCard(card); });
}

function confirmarCambioEstado(card, o, accionApi, titulo, mensaje) {
  const hoja = UI.abrirHoja({
    titulo: titulo,
    html: '<p class="t-body txt-2" style="margin-bottom:var(--sp-5)">' + UI.esc(mensaje) +
      '</p><div class="pila pila-2">' +
      '<button class="btn btn-primario btn-bloque pulsable" data-si>Confirmar</button>' +
      '<button class="btn btn-secundario btn-bloque pulsable" data-no>Cancelar</button></div>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', async function (e) {
        if (e.target.closest('[data-no]')) { hoja.cerrar(); cerrarCard(card); return; }
        if (!e.target.closest('[data-si]')) return;
        hoja.cerrar();
        try {
          await Api.llamar('objetivo.' + accionApi, { id_objetivo: o.id_objetivo });
          UI.avisar(accionApi === 'pausar' ? 'Objetivo pausado' : 'Objetivo despausado');
          App.recargar();
        } catch (err) { UI.avisarError(err); }
      });
    }
  });
}

/**
 * Mismo patrón en dos pasos que `producto.archivar` (§11.6): primero se pregunta sin
 * confirmar, y el mensaje EXACTO que da el backend es el que se muestra.
 * @param {Function} [alCancelar] cierra el gesto de deslizar si se llamó desde una
 *   tarjeta con el carril abierto; el detalle no tiene nada que cerrar, así que se omite.
 */
async function eliminarObjetivo(o, alCancelar) {
  let info;
  try {
    info = await Api.llamar('objetivo.eliminar', { id_objetivo: o.id_objetivo });
  } catch (e) { if (alCancelar) alCancelar(); return UI.avisarError(e); }

  const esArchivar = info.accion === 'ARCHIVAR';
  const hoja = UI.abrirHoja({
    titulo: (esArchivar ? 'Archivar' : 'Eliminar') + ' «' + o.nombre + '»',
    html: '<p class="t-body txt-2" style="margin-bottom:var(--sp-5)">' + UI.esc(info.mensaje) +
      '</p><div class="pila pila-2">' +
      '<button class="btn btn-peligro btn-bloque pulsable" data-si>' +
        (esArchivar ? 'Archivar' : 'Eliminar') + '</button>' +
      '<button class="btn btn-secundario btn-bloque pulsable" data-no>Cancelar</button></div>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', async function (e) {
        if (e.target.closest('[data-no]')) { hoja.cerrar(); if (alCancelar) alCancelar(); return; }
        if (!e.target.closest('[data-si]')) return;
        hoja.cerrar();
        try {
          await Api.llamar('objetivo.eliminar',
            { id_objetivo: o.id_objetivo, confirmar: true });
          UI.avisar(esArchivar ? 'Objetivo archivado' : 'Objetivo eliminado');
          App.recargar();
        } catch (err) { UI.avisarError(err); }
      });
    }
  });
}

function cerrarCard(card) {
  const c = card.querySelector('.obj-carril');
  if (c) c.style.transform = '';
  delete card.dataset.abierta;
}

/** Cierra la hoja abierta y, si el formulario guardó algo, recarga la pantalla. */
async function abrirYRecargar(abrir) {
  try { await abrir(); } catch (e) { UI.avisarError(e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETALLE (Capa 2 — §1.3 principio 6): histórico de aportes y proyecciones
// ═══════════════════════════════════════════════════════════════════════════════

async function abrirDetalle(id) {
  const cerrarAviso = UI.avisar('Abriendo…', { ms: 6000 });
  let d;
  try {
    d = await Api.llamar('objetivos.detalle', { id_objetivo: id });
  } catch (e) { cerrarAviso(); return UI.avisarError(e); }
  cerrarAviso();

  const m = Formularios.catalogos().config.moneda_base;
  const hoja = UI.abrirHoja({
    titulo: d.nombre,
    html: detalleObjetivoHtml(d, m),
    alAbrir: function (raiz) {
      raiz.addEventListener('click', async function (e) {
        if (e.target.closest('[data-al="editar"]')) {
          hoja.cerrar();
          return abrirYRecargar(function () { return App.abrirFormulario('objetivo', d); });
        }
        if (e.target.closest('[data-al="pausar"]')) {
          hoja.cerrar();
          try {
            await Api.llamar('objetivo.pausar', { id_objetivo: id });
            UI.avisar('Objetivo pausado'); App.recargar();
          } catch (err) { UI.avisarError(err); }
          return;
        }
        if (e.target.closest('[data-al="despausar"]')) {
          hoja.cerrar();
          try {
            await Api.llamar('objetivo.despausar', { id_objetivo: id });
            UI.avisar('Objetivo despausado'); App.recargar();
          } catch (err) { UI.avisarError(err); }
          return;
        }
        if (e.target.closest('[data-al="reiniciar"]')) { hoja.cerrar(); return abrirReiniciar(d); }
        if (e.target.closest('[data-al="eliminar"]')) {
          hoja.cerrar();
          return eliminarObjetivo(d);
        }
      });
    }
  });
}

function detalleObjetivoHtml(d, m) {
  const pct = Math.round(d.porcentaje * 100);
  const acciones = {
    ACTIVO: [['editar', 'pencil', 'Editar'], ['pausar', 'pause', 'Pausar']],
    PAUSADO: [['editar', 'pencil', 'Editar'], ['despausar', 'play', 'Despausar']],
    ALCANZADO: [['editar', 'pencil', 'Editar'], ['reiniciar', 'rotate-ccw', 'Reiniciar'],
                ['eliminar', 'trash-2', 'Eliminar']]
  }[d.estado] || [];

  return '<div class="fila" style="justify-content:center;margin-bottom:var(--sp-5)">' +
      '<div class="obj-circulo" style="--pct:' + pct + '">' +
        '<span class="t-title num">' + pct + '%</span>' +
      '</div>' +
    '</div>' +
    '<div class="pila pila-1" style="margin-bottom:var(--sp-5)">' +
      filaDetalleObj('Ahorrado', UI.monto(d.ahorrado, m, { sinSigno: true })) +
      filaDetalleObj('Meta', UI.monto(d.monto_meta, m, { sinSigno: true })) +
      filaDetalleObj('Falta', UI.monto(d.falta, m, { sinSigno: true })) +
      (d.aporte_mensual_sugerido > 0
        ? filaDetalleObj('Aporte sugerido', UI.monto(d.aporte_mensual_sugerido, m,
            { sinSigno: true }) + '/mes')
        : '') +
      (d.fecha_estimada_al_ritmo
        ? filaDetalleObj('Llegada al ritmo actual', fechaCortaObj(d.fecha_estimada_al_ritmo))
        : '') +
      (d.nota ? filaDetalleObj('Nota', UI.esc(d.nota)) : '') +
    '</div>' +
    '<div class="pila pila-2" style="margin-bottom:var(--sp-5)">' +
      acciones.map(function (a) {
        return '<button class="btn btn-secundario btn-bloque pulsable" data-al="' + a[0] + '">' +
          UI.ico(a[1], 'ico-16') + a[2] + '</button>';
      }).join('') +
    '</div>' +
    (d.aportes && d.aportes.length
      ? '<h3 class="t-overline txt-2" style="margin-bottom:var(--sp-2)">Histórico de aportes</h3>' +
        '<div class="pila">' + d.aportes.map(function (a) {
          return '<div class="fila-entre detalle-fila">' +
            '<span class="t-label txt-2">' + UI.esc(fechaCortaObj(a.fecha)) +
              (a.cuenta_origen ? ' · ' + UI.esc(a.cuenta_origen) : '') + '</span>' +
            '<span class="t-label num">' + UI.monto(a.importe, a.moneda, { sinSigno: true }) +
            '</span></div>';
        }).join('') + '</div>'
      : '<p class="t-caption txt-3">Todavía no hay aportes registrados.</p>');
}

function filaDetalleObj(etiqueta, valor) {
  return '<div class="fila-entre detalle-fila"><span class="t-label txt-2">' +
    UI.esc(etiqueta) + '</span><span class="t-label" style="text-align:right">' + valor +
    '</span></div>';
}

/** Reiniciar (§8.6, `rotate-ccw`): pide la nueva fecha esperada, el único dato que el
 *  backend exige y que el histórico de aportes no puede reconstruir por sí solo. */
function abrirReiniciar(d) {
  const idFecha = Campos.id();
  const hoja = UI.abrirHoja({
    titulo: 'Reiniciar «' + d.nombre + '»',
    html:
      '<p class="t-body txt-2" style="margin-bottom:var(--sp-4)">El progreso vuelve a cero. ' +
        'Tu histórico de aportes se conserva.</p>' +
      Campos.fecha({ id: idFecha, etiqueta: 'Nueva fecha esperada' }) +
      '<button class="btn btn-primario btn-bloque pulsable" style="margin-top:var(--sp-4)" ' +
        'data-confirmar>Reiniciar</button>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', async function (e) {
        if (!e.target.closest('[data-confirmar]')) return;
        const fecha = Campos.valor(raiz, idFecha);
        if (!fecha) return UI.avisar('Elige la nueva fecha esperada.', { error: true });
        hoja.cerrar();
        try {
          const r = await Api.llamar('objetivo.reiniciar',
            { id_objetivo: d.id_objetivo, fecha_esperada: fecha });
          UI.avisar((r.avisos && r.avisos[0]) || 'Objetivo reiniciado');
          App.recargar();
        } catch (err) { UI.avisarError(err); }
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GESTO DE DESLIZAR (§10.4), adaptado de `movimientos.js` a la tarjeta completa
// ═══════════════════════════════════════════════════════════════════════════════

function gestoDeslizarObjetivo(vista) {
  const UMBRAL = 72, ANCLA = 96, VEL = 0.11;
  let card = null, carril = null, x0 = 0, y0 = 0, dx = 0;
  let decidido = false, capturado = false, puntero = null;
  let xPrev = 0, tPrev = 0, vel = 0;

  vista.addEventListener('pointerdown', function (e) {
    if (puntero !== null) return;
    const c = e.target.closest('.obj-carril');
    if (!c) return;
    card = c.closest('.obj-card'); carril = c;
    x0 = e.clientX; y0 = e.clientY;
    xPrev = e.clientX; tPrev = performance.now(); vel = 0;
    dx = 0; decidido = false; capturado = false; puntero = e.pointerId;
  });

  vista.addEventListener('pointermove', function (e) {
    if (puntero !== e.pointerId || !carril) return;
    const ex = e.clientX - x0, ey = e.clientY - y0;

    if (!decidido) {
      if (Math.abs(ex) < 10 && Math.abs(ey) < 10) return;
      decidido = true;
      capturado = Math.abs(ex) > Math.abs(ey) * 1.5;
      if (capturado) {
        carril.setPointerCapture(e.pointerId);
        carril.style.transition = 'none';
      } else { puntero = null; carril = null; return; }
    }

    const ahora = performance.now();
    const dt = ahora - tPrev;
    if (dt > 0) vel = Math.abs(e.clientX - xPrev) / dt;
    xPrev = e.clientX; tPrev = ahora;

    dx = Math.abs(ex) > ANCLA
      ? Math.sign(ex) * (ANCLA + (Math.abs(ex) - ANCLA) * 0.3)
      : ex;
    carril.style.transform = 'translateX(' + dx + 'px)';
    card.dataset.lado = dx < 0 ? 'izq' : 'der';
  });

  function terminar(e) {
    if (puntero !== e.pointerId) return;
    puntero = null;
    if (!capturado || !carril) { carril = null; return; }

    if (performance.now() - tPrev > 120) vel = 0;
    const anclar = Math.abs(dx) > UMBRAL || vel > VEL;
    carril.style.transition = '';
    if (anclar) {
      vista.querySelectorAll('.obj-card[data-abierta]').forEach(function (o) {
        if (o !== card) cerrarCard(o);
      });
      carril.style.transform = 'translateX(' + (dx < 0 ? -ANCLA : ANCLA) + 'px)';
      card.dataset.abierta = dx < 0 ? 'izq' : 'der';
    } else {
      carril.style.transform = '';
      delete card.dataset.abierta;
    }
    carril = null;
  }

  vista.addEventListener('pointerup', terminar);
  vista.addEventListener('pointercancel', terminar);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTADOS Y AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════

function esqueleto() {
  return '<div class="tarjeta hero-patrimonio pila pila-2">' +
    '<div class="hueso hueso-linea" style="width:40%"></div>' +
    '<div class="hueso hueso-cifra" style="width:60%"></div>' +
  '</div>' +
  '<div class="pila pila-3" style="margin-top:var(--sp-4)">' +
    '<div class="tarjeta" style="height:120px"></div>' +
    '<div class="tarjeta" style="height:120px"></div>' +
  '</div>';
}

function pintarVacio(vista) {
  vista.innerHTML = UI.vacio({
    icono: 'target',
    titulo: 'Ponle nombre a tu próxima meta',
    texto: 'Un viaje, un fondo de emergencia, lo que sea que estés ahorrando.',
    cta: { texto: 'Crear objetivo', accion: 'objetivo' }
  });
  vista.addEventListener('click', async function (e) {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    try { await App.abrirFormulario(b.dataset.accion); }
    catch (err) { UI.avisarError(err); }
  });
}

/** §10.2: stagger de 50ms. */
function escalonar(vista) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  vista.querySelectorAll('.obj-card').forEach(function (c, i) {
    c.style.animationDelay = Math.min(i * 50, 200) + 'ms';
    c.classList.add('entra');
  });
}

const MESES_OBJ = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct',
                   'nov', 'dic'];
function fechaCortaObj(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  if (p.length !== 3) return String(iso);
  return Number(p[2]) + ' ' + (MESES_OBJ[Number(p[1]) - 1] || '');
}

})();
