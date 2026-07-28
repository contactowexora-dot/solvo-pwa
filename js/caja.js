/**
 * SOLVO — Pantalla Control de caja. Manual 5 §A.4.
 *
 * Responde a «después de todos mis compromisos, ¿cuánto dinero libre me queda este
 * mes?» — una pregunta distinta de la de Presupuesto (§A.1). Pantalla secundaria: se
 * llega desde la cabecera de Presupuesto y desde el menú de perfil, igual que
 * Objetivos (Manual 1 §4.1).
 *
 * Dos bloques del flujo NO los escribe la persona —compromisos de deuda y ahorro
 * comprometido— porque `Caja.gs` ya los deriva de cronogramas y objetivos (§A.2). Por
 * eso llevan un ícono `info` que explica de dónde sale el número: nunca un número
 * calculado sin explicación disponible.
 *
 * Todo el archivo vive en un IIFE por la misma razón que las demás pantallas.
 */
(function () {

const Cj = (function () {
  const est = { periodo: null, datos: null, vista: null };
  return { est: est };
})();

App.registrar('caja', async function (vista) {
  vista.innerHTML = esqueleto();
  Cj.est.vista = vista;

  await Formularios.cargarCatalogos();

  await Api.leer('caja.estado', Cj.est.periodo ? { periodo: Cj.est.periodo } : {},
    { clave: 'caja' }, function (d) {
      Cj.est.datos = d;
      Cj.est.periodo = d.periodo;
      pintar(vista);
      conectar(vista);
    });
}, 'Control de caja');

// ═══════════════════════════════════════════════════════════════════════════════
// PINTADO
// ═══════════════════════════════════════════════════════════════════════════════

function pintar(vista) {
  const d = Cj.est.datos;
  const m = d.moneda_base;

  if (d.estados.sin_conceptos) { pintarVacio(vista); return; }

  Graficos.destruirTodos();
  vista.innerHTML =
    heroCaja(d, m) +
    tarjetaCascada() +
    detalleFlujo(d, m) +
    repartoSugerido(d, m) +
    fondoEmergencia(d, m) +
    '<div class="pila pila-2" style="margin-top:var(--sp-4)">' +
      '<button class="btn btn-primario btn-bloque pulsable" data-al="aplicar">' +
        'Aplicar al presupuesto</button>' +
      '<button class="btn btn-secundario btn-bloque pulsable" data-al="agregar">' +
        UI.ico('plus', 'ico-16') + 'Agregar concepto fijo</button>' +
    '</div>';

  gestoPeriodoCaja(vista.querySelector('[data-hero]'));
  montarCascada(vista, d, m);
}

function heroCaja(d, m) {
  const v = d.variacion_vs_anterior;
  const negativo = d.estados.disponible_negativo;
  return '<section class="tarjeta hero-patrimonio" data-hero>' +
    '<span class="t-overline txt-2">' + UI.esc(nombrePeriodoCaja(d.periodo)) + '</span>' +
    '<span class="t-overline txt-2">Disponible para gastar</span>' +
    '<div class="fila" style="align-items:baseline;gap:var(--sp-2);margin-top:var(--sp-1)">' +
      '<span class="t-display-xl num' + (negativo ? ' neg' : '') + '">' +
        UI.monto(d.disponible_para_gastar, m, { sinSigno: true, sinDecimales: true }) + '</span>' +
      (v ? UI.pildoraVariacion(v.variacion_pct) : '') +
    '</div>' +
    (v ? '<span class="t-caption txt-2">vs. ' + UI.esc(nombrePeriodoCaja(v.periodo_anterior)) +
         '</span>' : '') +
    (negativo
      ? '<p class="t-caption warn" style="margin-top:var(--sp-2)">' +
        UI.esc(d.estados.mensaje_negativo) + '</p>'
      : '') +
  '</section>';
}

function tarjetaCascada() {
  return '<section class="tarjeta" style="margin-top:var(--sp-4)">' +
    '<span class="t-overline txt-2">De tus ingresos a tu disponible</span>' +
    '<div class="grafico" data-cascada><div class="grafico-hueso"></div></div>' +
  '</section>';
}

/** Manual 5 §A.7: G12, cascada de 5 barras — ya reutiliza `Graficos.opcionesCascada`. */
function montarCascada(vista, d, m) {
  const f = d.flujo;
  const trasFijos = redondear2Caja_(f.total_ingresos - f.gastos_fijos);
  const trasDeuda = redondear2Caja_(trasFijos - f.compromisos_deuda);
  const trasAhorro = redondear2Caja_(trasDeuda - f.ahorro_comprometido);

  const barras = [
    { etiqueta: 'Ingresos', desde: 0, hasta: f.total_ingresos, valor: f.total_ingresos,
      color: 'positive' },
    { etiqueta: 'Fijos', desde: f.total_ingresos, hasta: trasFijos, valor: f.gastos_fijos,
      color: 'negative' },
    { etiqueta: 'Deuda', desde: trasFijos, hasta: trasDeuda, valor: f.compromisos_deuda,
      color: 'negative' },
    { etiqueta: 'Ahorro', desde: trasDeuda, hasta: trasAhorro, valor: f.ahorro_comprometido,
      color: 'accent' },
    { etiqueta: 'Libre', desde: 0, hasta: f.disponible_variable, valor: f.disponible_variable,
      color: 'ink' }
  ];

  const el = vista.querySelector('[data-cascada]');
  if (!el) return;
  Graficos.montar(el, function () { return Graficos.opcionesCascada(barras, m); })
    .then(function (api) {
      if (!api) return;
      el.dataset.listo = 'true';
      api.inst.on('click', function (pr) {
        if (pr.seriesIndex !== 1) return;
        const claves = ['ingresos_fijos', 'gastos_fijos', 'compromisos_deuda',
                        'ahorro_comprometido', null];
        const clave = claves[pr.dataIndex];
        if (clave) abrirDesglose(clave, barras[pr.dataIndex].etiqueta, m);
      });
    });
}

function redondear2Caja_(n) { return Math.round(n * 100) / 100; }

const FILAS_FLUJO = [
  ['ingresos_fijos', 'Ingresos fijos', '+', false],
  ['ingresos_variables', 'Ingresos variables', '+', false],
  ['gastos_fijos', 'Gastos fijos', '−', false],
  ['compromisos_deuda', 'Compromisos de deuda', '−', true],
  ['ahorro_comprometido', 'Ahorro comprometido', '−', true]
];

function detalleFlujo(d, m) {
  const f = d.flujo;
  const filas = FILAS_FLUJO.map(function (x) {
    const clave = x[0], etiqueta = x[1], signo = x[2], calculado = x[3];
    const estimado = clave === 'ingresos_variables' && f.ingresos_variables_estimados;
    return '<button class="fila-entre detalle-fila pulsable" style="width:100%" ' +
      'data-desglose="' + clave + '" data-etiqueta="' + UI.esc(etiqueta) + '">' +
      '<span class="t-label txt-2">' + UI.esc(etiqueta) +
        (estimado ? ' <span class="txt-3">(estimado)</span>' : '') +
        (calculado ? UI.ico('info', 'ico-14') : '') + '</span>' +
      '<span class="t-label num">' + signo + ' ' + UI.monto(f[clave], m, { sinSigno: true }) +
        '</span>' +
    '</button>';
  });

  return '<section class="tarjeta pila pila-1" style="margin-top:var(--sp-4)">' +
    '<p class="t-overline txt-2" style="margin-bottom:var(--sp-1)">Detalle del flujo</p>' +
    filas.slice(0, 2).join('') +
    '<div class="fila-entre detalle-fila"><span class="t-label">Total ingresos</span>' +
      '<span class="t-label num">' + UI.monto(f.total_ingresos, m, { sinSigno: true }) +
      '</span></div>' +
    filas.slice(2).join('') +
    '<div class="fila-entre detalle-fila"><span class="t-label">Disponible para variables</span>' +
      '<span class="t-label num">' + UI.monto(f.disponible_variable, m, { sinSigno: true }) +
      '</span></div>' +
  '</section>';
}

function repartoSugerido(d, m) {
  const r = d.reparto;
  const marcos = [['50_30_20', '50/30/20'], ['BASE_CERO', 'Base cero'], ['PERSONALIZADO', 'Propio']];
  return '<section class="tarjeta" style="margin-top:var(--sp-4)">' +
    '<p class="t-overline txt-2" style="margin-bottom:var(--sp-2)">Reparto sugerido</p>' +
    '<div class="segmentado" data-marcos style="margin-bottom:var(--sp-4)">' +
      marcos.map(function (x) {
        return '<button type="button" class="segmento pulsable" data-marco="' + x[0] + '" ' +
          'aria-checked="' + (r.marco === x[0]) + '">' + x[1] + '</button>';
      }).join('') +
    '</div>' +
    bloqueReparto('Necesidades', r.necesidades, m) +
    bloqueReparto('Deseos', r.deseos, m) +
    bloqueReparto('Ahorro', r.ahorro, m) +
    (r.base_cero
      ? '<div class="fila-entre" style="margin-top:var(--sp-2)">' +
        '<span class="t-label txt-2">Sin asignar</span>' +
        '<span class="t-label num ' + (r.base_cero.completo ? '' : 'warn') + '">' +
          UI.monto(r.base_cero.sin_asignar, m, { sinSigno: true }) + '</span></div>'
      : '') +
    '<p class="t-caption txt-3" style="margin-top:var(--sp-4)">' + UI.esc(d.aviso_marcos) + '</p>' +
  '</section>';
}

function bloqueReparto(nombre, b, m) {
  const icono = b.estado === 'SIN_DATOS' ? ''
    : b.estado === 'OK' ? UI.ico('circle-check', 'ico-14')
    : UI.ico('triangle-alert', 'ico-14');
  const clase = b.estado === 'OK' ? '' : b.estado === 'DESVIADO' ? 'warn' : 'txt-3';
  return '<div class="fila-entre" style="margin-bottom:var(--sp-2)">' +
    '<span class="t-label">' + nombre + ' ' + Math.round(b.pct_sugerido * 100) + '%</span>' +
    '<span class="t-label num">' + UI.monto(b.monto_sugerido, m, { sinSigno: true }) + '</span>' +
  '</div>' +
  '<p class="t-caption ' + clase + '" style="margin-bottom:var(--sp-3)">' +
    (b.estado === 'SIN_DATOS' ? 'Aún sin datos'
      : 'tu situación actual: ' + Math.round(b.pct_real * 100) + '% ' + icono) +
  '</p>';
}

function fondoEmergencia(d, m) {
  const f = d.fondo_emergencia;
  const pct = Math.round(f.porcentaje * 100);
  return '<section class="tarjeta" style="margin-top:var(--sp-4)">' +
    '<p class="t-overline txt-2" style="margin-bottom:var(--sp-2)">Fondo de emergencia</p>' +
    '<div class="pista-progreso" style="margin-bottom:var(--sp-2)">' +
      '<div class="relleno-progreso" style="width:' + Math.min(pct, 100) +
        '%;background:var(--accent)"></div>' +
    '</div>' +
    '<span class="t-label txt-2">' + f.meses_cubiertos + ' de ' + f.meses_objetivo +
      ' meses</span><br>' +
    '<span class="t-caption txt-2">Tienes ' + UI.monto(f.actual, m, { sinSigno: true }) +
      ' · meta ' + UI.monto(f.meta, m, { sinSigno: true }) + '</span>' +
  '</section>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

function conectar(vista) {
  if (vista._conectado) return;
  vista._conectado = true;

  vista.addEventListener('click', async function (e) {
    const desg = e.target.closest('[data-desglose]');
    if (desg) {
      abrirDesglose(desg.dataset.desglose, desg.dataset.etiqueta, Cj.est.datos.moneda_base);
      return;
    }
    const marco = e.target.closest('[data-marco]');
    if (marco) { await elegirMarco(marco.dataset.marco); return; }

    if (e.target.closest('[data-al="aplicar"]')) { return abrirAplicarPresupuesto(); }
    if (e.target.closest('[data-al="agregar"]')) {
      return abrirYRecargarCaja(function () { return App.abrirFormulario('concepto-caja'); });
    }
  });
}

async function abrirYRecargarCaja(abrir) {
  try { await abrir(); } catch (e) { UI.avisarError(e); }
}

/** El listener de clics ya está enganchado a `vista` (guardado por `_conectado`): un
 *  repintado solo necesita rehacer el HTML, no reengancharlo. */
function repintarActualCaja() {
  if (!Cj.est.vista || !Cj.est.vista.isConnected) return;
  pintar(Cj.est.vista);
}

/** Refresca en silencio, sin el parpadeo de esqueleto de `App.recargar()`. */
function refrescarCajaSilencioso() {
  Api.leer('caja.estado', { periodo: Cj.est.periodo }, { clave: 'caja' }, function (d) {
    Cj.est.datos = d;
    repintarActualCaja();
  }).catch(function () {});
}

async function elegirMarco(nombre) {
  if (nombre === Cj.est.datos.marco.marco_referencia) return;

  if (nombre === 'PERSONALIZADO') { abrirPropioSheet(); return; }

  try {
    await Api.llamar('caja.marco.guardar', { periodo: Cj.est.periodo, marco_referencia: nombre });
    refrescarCajaSilencioso();
  } catch (err) { UI.avisarError(err); }
}

function abrirPropioSheet() {
  const marco = Cj.est.datos.marco;
  const yaPropio = marco.marco_referencia === 'PERSONALIZADO';
  const idN = Campos.id(), idD = Campos.id(), idA = Campos.id();

  const hoja = UI.abrirHoja({
    titulo: 'Reparto propio',
    html: '<p class="t-body txt-2" style="margin-bottom:var(--sp-4)">Los tres porcentajes ' +
        'deben sumar 100%.</p>' +
      Campos.entero({ id: idN, etiqueta: 'Necesidades %',
        valor: yaPropio ? Math.round(marco.pct_necesidades * 100) : 50 }) +
      Campos.entero({ id: idD, etiqueta: 'Deseos %',
        valor: yaPropio ? Math.round(marco.pct_deseos * 100) : 30 }) +
      Campos.entero({ id: idA, etiqueta: 'Ahorro %',
        valor: yaPropio ? Math.round(marco.pct_ahorro * 100) : 20 }) +
      '<button class="btn btn-primario btn-bloque pulsable" style="margin-top:var(--sp-4)" ' +
        'data-guardar>Guardar</button>',
    alAbrir: function (raiz) {
      Campos.conectar(raiz);
      raiz.addEventListener('click', async function (e) {
        if (!e.target.closest('[data-guardar]')) return;
        const n = Campos.valor(raiz, idN) || 0, dd = Campos.valor(raiz, idD) || 0,
              a = Campos.valor(raiz, idA) || 0;
        if (n + dd + a !== 100) {
          return UI.avisar('Los tres porcentajes deben sumar 100%. Ahora suman ' +
            (n + dd + a) + '%.', { error: true });
        }
        hoja.cerrar();
        try {
          await Api.llamar('caja.marco.guardar', {
            periodo: Cj.est.periodo, marco_referencia: 'PERSONALIZADO',
            pct_necesidades: n / 100, pct_deseos: dd / 100, pct_ahorro: a / 100
          });
          refrescarCajaSilencioso();
        } catch (err) { UI.avisarError(err); }
      });
    }
  });
}

function abrirDesglose(clave, etiqueta, m) {
  const items = (Cj.est.datos.desgloses || {})[clave] || [];
  const hoja = UI.abrirHoja({
    titulo: etiqueta,
    html: items.length
      ? '<div class="pila">' + items.map(function (it) {
          return '<div class="fila-entre detalle-fila">' +
            '<span class="t-label txt-2">' + UI.esc(it.nombre) + '</span>' +
            '<span class="t-label num">' + UI.monto(it.monto, m, { sinSigno: true }) +
            '</span></div>';
        }).join('') + '</div>'
      : '<p class="t-caption txt-3">Sin conceptos declarados para este bloque.</p>'
  });
}

async function abrirAplicarPresupuesto() {
  const cerrarAviso = UI.avisar('Calculando…', { ms: 6000 });
  let propuesta;
  try {
    propuesta = await Api.llamar('caja.aplicar', { periodo: Cj.est.periodo });
  } catch (e) { cerrarAviso(); return UI.avisarError(e); }
  cerrarAviso();

  if (!propuesta.hay_historico) {
    UI.avisar(propuesta.motivo_sin_historico, { error: true, ms: 6000 });
    return;
  }

  const m = Cj.est.datos.moneda_base;
  const ids = {};
  propuesta.propuesta.forEach(function (p) { ids[p.id_categoria] = Campos.id(); });

  const hoja = UI.abrirHoja({
    titulo: 'Aplicar al presupuesto',
    html: '<p class="t-body txt-2" style="margin-bottom:var(--sp-4)">Repartido según tu gasto ' +
        'de los últimos 3 meses. Cada límite es editable antes de guardar.</p>' +
      '<div class="pila pila-3" style="margin-bottom:var(--sp-4)">' +
        propuesta.propuesta.map(function (p) {
          return Campos.monto({ id: ids[p.id_categoria], etiqueta: p.nombre,
            valor: p.monto_propuesto });
        }).join('') +
      '</div>' +
      '<button class="btn btn-primario btn-bloque pulsable" data-confirmar>' +
        'Guardar presupuesto</button>',
    alAbrir: function (raiz) {
      Campos.conectar(raiz);
      raiz.addEventListener('click', async function (e) {
        if (!e.target.closest('[data-confirmar]')) return;
        const presupuestos = propuesta.propuesta.map(function (p) {
          return { id_categoria: p.id_categoria, monto: Campos.valor(raiz, ids[p.id_categoria]) || 0 };
        });
        hoja.cerrar();
        try {
          await Api.llamar('caja.aplicar.confirmar',
            { periodo: Cj.est.periodo, presupuestos: presupuestos, reemplazar: true });
          UI.avisar('Presupuesto actualizado');
        } catch (err) { UI.avisarError(err); }
      });
    }
  });
}

// Puente para `form-concepto-caja.js` (único consumidor): refresca esta pantalla sin
// el parpadeo de esqueleto de `App.recargar()`.
window.SolvoCaja = { refrescarSilencioso: refrescarCajaSilencioso };

// ═══════════════════════════════════════════════════════════════════════════════
// PERIODO (mismo gesto que Inicio y Presupuesto)
// ═══════════════════════════════════════════════════════════════════════════════

function gestoPeriodoCaja(hero) {
  if (!hero) return;
  let x0 = 0, y0 = 0, capturado = false, decidido = false;

  hero.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    x0 = e.clientX; y0 = e.clientY; capturado = false; decidido = false;
  });
  hero.addEventListener('pointermove', function (e) {
    if (decidido) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
    decidido = true;
    capturado = Math.abs(dx) > Math.abs(dy) * 1.6;
    if (capturado) hero.setPointerCapture(e.pointerId);
  });
  hero.addEventListener('pointerup', function (e) {
    if (!capturado) return;
    capturado = false;
    const dx = e.clientX - x0;
    if (Math.abs(dx) < 56) return;
    cambiarPeriodoCaja(dx < 0 ? 1 : -1);
  });
  hero.addEventListener('pointercancel', function () { capturado = false; });
}

function cambiarPeriodoCaja(delta) {
  const p = String(Cj.est.periodo || '').split('-');
  if (p.length !== 2) return;
  const d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
  const nuevo = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

  const hoy = new Date();
  const tope = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  if (nuevo > tope) return;

  Cj.est.periodo = nuevo;
  App.recargar();
}

const MESES_CAJA = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                     'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function nombrePeriodoCaja(periodo) {
  const p = String(periodo).split('-');
  const mes = MESES_CAJA[Number(p[1]) - 1];
  if (!mes) return String(periodo);
  return Number(p[0]) === new Date().getFullYear() ? mes : mes + ' ' + p[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTADOS
// ═══════════════════════════════════════════════════════════════════════════════

function esqueleto() {
  return '<section class="tarjeta hero-patrimonio pila pila-2">' +
    '<div class="hueso hueso-linea" style="width:40%"></div>' +
    '<div class="hueso hueso-cifra" style="width:60%"></div>' +
  '</section>' +
  '<div class="tarjeta" style="margin-top:var(--sp-4);height:220px">' +
    '<div class="grafico-hueso"></div></div>';
}

/** Asistente de 3 pasos (§A.4): sin conceptos declarados no hay nada que calcular
 *  todavía — se simplifica a un estado vacío con el primer paso como CTA. */
function pintarVacio(vista) {
  vista.innerHTML = UI.vacio({
    icono: 'wallet',
    titulo: 'Declara tus ingresos y gastos fijos',
    texto: 'Con eso, Control de caja calcula cuánto dinero libre te queda cada mes.',
    cta: { texto: 'Agregar concepto fijo', accion: 'agregar-concepto' }
  });
  if (vista._vacioConectado) return;
  vista._vacioConectado = true;
  vista.addEventListener('click', async function (e) {
    if (!e.target.closest('[data-accion="agregar-concepto"]')) return;
    try { await App.abrirFormulario('concepto-caja'); } catch (err) { UI.avisarError(err); }
  });
}

})();
