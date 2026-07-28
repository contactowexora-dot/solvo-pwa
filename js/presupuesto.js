/**
 * SOLVO — Pantalla Presupuesto. Manual 1 §8.4 · Manual 5 §A.6.
 *
 * Responde a «¿cuánto puedo gastar todavía este mes?». Es pestaña (Manual 5 §D2), con
 * su propio control de periodo por gesto (§8.1, igual que Inicio).
 *
 * La cabecera «Disponible para gastar» explica de dónde sale el número que esta
 * pantalla reparte (Manual 5 §A.6): lo calcula Control de caja, y por eso
 * `Presupuestos.estado()` ya lo trae armado en `.caja` — null si `Caja.gs` no
 * respondió, para no enseñar ceros que parecerían un dato real.
 *
 * Todo el archivo vive en un IIFE por la misma razón que las demás pantallas.
 */
(function () {

const Pres = (function () {
  const est = { periodo: null, datos: null, vista: null };
  return { est: est };
})();

App.registrar('presupuesto', async function (vista) {
  vista.innerHTML = esqueleto();
  Pres.est.vista = vista;

  await Formularios.cargarCatalogos();

  // `Api.leer` pinta al instante lo último guardado en este teléfono y otra vez cuando
  // responde el servidor — por eso `conectar` está protegido para engancharse una sola
  // vez aunque esta función pueda llamarse dos veces (docs/TRASPASO.md §1).
  await Api.leer('presupuesto.estado',
    Pres.est.periodo ? { periodo: Pres.est.periodo } : {},
    { clave: 'presupuesto' },
    function (d) {
      Pres.est.datos = d;
      Pres.est.periodo = d.periodo;
      pintar(vista);
      conectar(vista);
    });
}, 'Presupuesto');

// ═══════════════════════════════════════════════════════════════════════════════
// PINTADO
// ═══════════════════════════════════════════════════════════════════════════════

function pintar(vista) {
  const d = Pres.est.datos;
  const m = Formularios.catalogos().config.moneda_base;
  const vacioTotal = d.categorias.length === 0 && d.sin_presupuesto.length === 0;

  if (vacioTotal) { pintarVacio(vista); return; }

  vista.innerHTML =
    heroPresupuesto(d, m) +
    bloqueCaja(d, m) +
    bloquePrediccion(d, m) +
    listaCategorias(d, m);
  escalonar(vista);
  gestoPeriodo(vista.querySelector('[data-hero]'));
}

function heroPresupuesto(d, m) {
  const negativo = d.restante < 0;
  return '<section class="tarjeta hero-patrimonio" data-hero>' +
    '<div class="fila-entre">' +
      '<span class="t-overline txt-2">' + UI.esc(nombrePeriodoPres(d.periodo)) + '</span>' +
      (d.n_excedidas > 0
        ? '<span class="badge">' + d.n_excedidas + ' excedida' +
          (d.n_excedidas > 1 ? 's' : '') + '</span>'
        : '') +
    '</div>' +
    '<span class="t-overline txt-2">Gastado del presupuesto</span>' +
    '<div class="fila" style="align-items:baseline;gap:var(--sp-2);margin-top:var(--sp-1)">' +
      '<span class="t-display-xl num">' +
        UI.monto(d.total_gastado, m, { sinSigno: true, sinDecimales: true }) + '</span>' +
    '</div>' +
    '<span class="t-caption txt-2">de ' + UI.monto(d.total_presupuestado, m, { sinSigno: true }) +
      ' · ' + (negativo
        ? UI.monto(Math.abs(d.restante), m, { sinSigno: true }) + ' de exceso'
        : UI.monto(d.restante, m, { sinSigno: true }) + ' restante') +
      ' · ' + d.dias_restantes + ' día' + (d.dias_restantes === 1 ? '' : 's') + ' restantes' +
    '</span>' +
  '</section>';
}

/** Manual 5 §A.6: explica de dónde sale el disponible que esta pantalla reparte. */
function bloqueCaja(d, m) {
  const c = d.caja;
  if (!c) return '';   // Caja.gs no respondió: mejor nada que un cero falso.

  const pct = c.pct_asignado != null ? Math.round(c.pct_asignado * 100) : null;
  return '<button class="tarjeta tarjeta-plana pulsable" data-al="caja" ' +
    'style="width:100%;text-align:left;margin-top:var(--sp-4)">' +
    '<div class="fila-entre">' +
      '<span class="t-overline txt-2">Disponible para gastar</span>' +
      UI.ico('chevron-right', 'ico-16') +
    '</div>' +
    '<span class="t-display-l num">' + UI.monto(c.disponible, m, { sinSigno: true }) + '</span>' +
    '<p class="t-caption txt-2" style="margin-top:2px">Ingresos ' +
      UI.monto(c.total_ingresos, m, { sinSigno: true }) + ' − compromisos ' +
      UI.monto(c.compromisos, m, { sinSigno: true }) + '</p>' +
    '<div class="fila-entre" style="margin-top:var(--sp-3)">' +
      '<span class="t-label txt-2">Asignado ' + UI.monto(c.asignado, m, { sinSigno: true }) +
        (pct != null ? ' · ' + pct + '%' : '') + '</span>' +
      '<span class="t-label txt-2">Sin asignar ' +
        UI.monto(c.sin_asignar, m, { sinSigno: true }) + '</span>' +
    '</div>' +
    '<div class="pista-progreso" style="margin-top:var(--sp-2)">' +
      '<div class="relleno-progreso" style="width:' + Math.min(Math.max(pct || 0, 0), 100) +
        '%;background:' + (c.sobre_asignado ? 'var(--negative)' : 'var(--accent)') + '"></div>' +
    '</div>' +
    (c.sobre_asignado
      ? '<p class="t-caption warn" style="margin-top:var(--sp-2)">' +
        UI.esc(c.mensaje_sobre_asignado) + '</p>'
      : '') +
  '</button>';
}

/** «A este ritmo cerrarás en…». Solo desde el día 8 del periodo (§8.4). */
function bloquePrediccion(d, m) {
  const p = d.prediccion;
  if (!p || !p.disponible) return '';
  return '<section class="tarjeta tarjeta-plana" style="margin-top:var(--sp-4)">' +
    '<span class="t-overline txt-2">Predicción de cierre</span>' +
    '<p class="t-body" style="margin-top:var(--sp-1)">A este ritmo cerrarás en ' +
      '<b class="num">' + UI.monto(p.proyectado, m, { sinSigno: true }) + '</b>' +
      (p.sobre_presupuesto
        ? ' (<span class="warn">' + UI.monto(p.desvio, m, { sinSigno: true }) +
          ' sobre tu presupuesto</span>)'
        : '') + '.</p>' +
  '</section>';
}

function listaCategorias(d, m) {
  const cabecera = '<div class="fila-entre" style="margin-top:var(--sp-4)">' +
    '<span class="t-overline txt-2">Categorías</span>' +
    '<button class="btn-icono pulsable" data-al="agregar-limite" ' +
      'aria-label="Asignar presupuesto a una categoría">' + UI.ico('plus') + '</button>' +
  '</div>';
  const conBudget = d.categorias.map(function (c) { return filaCategoria(c, m); }).join('');
  const sinBudget = d.sin_presupuesto.length
    ? '<p class="t-overline txt-2" style="margin:var(--sp-4) 0 var(--sp-2)">Sin presupuesto</p>' +
      d.sin_presupuesto.map(function (c) { return filaSinPresupuesto(c, m); }).join('')
    : '';
  return cabecera + '<div class="pila pila-3" style="margin-top:var(--sp-2)" data-lista>' +
    conBudget + '</div>' + sinBudget;
}

function nivelColorPres_(nivel) {
  if (nivel === 'EXCEDIDO') return 'var(--negative)';
  if (nivel === 'CERCA') return 'var(--warning)';
  return 'var(--positive)';
}

function filaCategoria(c, m) {
  const pct = Math.round(c.porcentaje * 100);
  return '<button class="tarjeta pulsable" style="width:100%;text-align:left" ' +
    'data-categoria="' + UI.esc(c.id_categoria) + '">' +
    '<div class="fila">' +
      '<span class="ico-cat" style="--color-cat:' + UI.esc(c.color) + '">' +
        UI.ico(c.icono) + '</span>' +
      '<span class="crece pila" style="gap:2px">' +
        '<span class="t-card-title recorta">' + UI.esc(c.nombre) + '</span>' +
        '<span class="t-caption txt-2">' + UI.monto(c.gastado, m, { sinSigno: true }) +
          ' de ' + UI.monto(c.presupuestado, m, { sinSigno: true }) + '</span>' +
      '</span>' +
      (c.excedido
        ? '<span class="badge">Excedido</span>'
        : '<span class="t-title num">' + pct + '%</span>') +
    '</div>' +
    '<div class="pista-progreso" style="margin-top:var(--sp-3)">' +
      '<div class="relleno-progreso" style="width:' + Math.min(pct, 100) +
        '%;background:' + nivelColorPres_(c.nivel) + '"></div>' +
    '</div>' +
  '</button>';
}

function filaSinPresupuesto(c, m) {
  return '<div class="tarjeta tarjeta-plana fila" data-sin-presupuesto="' +
    UI.esc(c.id_categoria) + '">' +
    '<span class="ico-cat" style="--color-cat:' + UI.esc(c.color) + '">' +
      UI.ico(c.icono) + '</span>' +
    '<span class="crece pila" style="gap:2px">' +
      '<span class="t-card-title recorta">' + UI.esc(c.nombre) + '</span>' +
      '<span class="t-caption txt-2">' + UI.monto(c.gastado, m, { sinSigno: true }) +
        ' gastados</span>' +
    '</span>' +
    '<button class="btn btn-secundario pulsable" data-asignar="' + UI.esc(c.id_categoria) +
      '">Asignar</button>' +
  '</div>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

function conectar(vista) {
  if (vista._conectado) return;
  vista._conectado = true;

  vista.addEventListener('click', function (e) {
    if (e.target.closest('[data-al="caja"]')) { App.ir('caja'); return; }

    if (e.target.closest('[data-al="agregar-limite"]')) {
      // Cualquier categoría de gasto, no solo las que ya tienen consumo este periodo —
      // sin esto no había forma de presupuestar una categoría antes de gastar en ella.
      // Se usa un selector propio (no `Formularios.elegirCategoria`): el presupuesto
      // reparte por categoría PRINCIPAL, nunca por subcategoría, y ese selector obliga
      // a bajar a una subcategoría en cuanto la categoría tiene alguna.
      abrirSelectorCategoriaGasto(function (idCat) {
        if (categoriaPorId(idCat)) {
          return UI.avisar('Esa categoría ya tiene un presupuesto asignado.', { error: true });
        }
        const cat = Formularios.buscarCategoria(idCat);
        abrirAsignarLimite({ id_categoria: idCat, nombre: cat.nombre,
                              presupuestado: 0, es_recurrente: false });
      });
      return;
    }

    const asignar = e.target.closest('[data-asignar]');
    if (asignar) {
      const c = sinPresupuestoPorId(asignar.dataset.asignar);
      if (c) abrirAsignarLimite({ id_categoria: c.id_categoria, nombre: c.nombre,
                                   presupuestado: 0, es_recurrente: false });
      return;
    }

    const cat = e.target.closest('[data-categoria]');
    if (cat) { abrirDetalleCategoria(cat.dataset.categoria); return; }
  });
}

function categoriaPorId(id) {
  return (Pres.est.datos.categorias || []).filter(function (c) {
    return c.id_categoria === id; })[0] || null;
}
function sinPresupuestoPorId(id) {
  return (Pres.est.datos.sin_presupuesto || []).filter(function (c) {
    return c.id_categoria === id; })[0] || null;
}

function repintarActual() {
  if (!Pres.est.vista || !Pres.est.vista.isConnected) return;
  pintar(Pres.est.vista);
}

async function guardarLimite(idCategoria, monto, esRecurrente) {
  try {
    const r = await Api.llamar('presupuesto.guardar', {
      periodo: Pres.est.periodo,
      presupuestos: [{ id_categoria: idCategoria, monto: monto, es_recurrente: !!esRecurrente }]
    });
    // El backend ya devuelve el estado recalculado: repinta sin otro viaje ni esqueleto.
    Pres.est.datos = r.estado;
    UI.avisar(monto > 0 ? 'Presupuesto guardado' : 'Límite quitado');
    repintarActual();
  } catch (err) { UI.avisarError(err); }
}

/**
 * Selector de categoría de gasto SIN bajar a subcategoría — el presupuesto reparte
 * por categoría principal (Manual 1 §8.4). `Formularios.elegirCategoria` no sirve
 * aquí: en cuanto una categoría tiene subcategorías, obliga a elegir una de ellas y
 * no deja seleccionar la categoría sola.
 */
function abrirSelectorCategoriaGasto(alElegir) {
  const cats = Formularios.categoriasDe('GASTO');
  const hoja = UI.abrirHoja({
    titulo: 'Categoría',
    html: '<ul class="pila pila-1">' + cats.map(function (c) {
      return '<li><button type="button" class="fila pulsable fila-opcion" data-cat="' +
        UI.esc(c.id_categoria) + '">' +
        '<span class="ico-cat ico-cat-sm" style="--color-cat:' + UI.esc(c.color) + '">' +
          UI.ico(c.icono) + '</span>' +
        '<span class="crece t-card-title" style="text-align:left">' + UI.esc(c.nombre) +
          '</span>' +
      '</button></li>';
    }).join('') + '</ul>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', function (e) {
        const b = e.target.closest('[data-cat]');
        if (!b) return;
        hoja.cerrar();
        alElegir(b.dataset.cat);
      });
    }
  });
}

function abrirAsignarLimite(cat) {
  const idMonto = Campos.id();
  const idRecurrente = Campos.id();
  const editando = !!cat.presupuestado;

  const hoja = UI.abrirHoja({
    titulo: (editando ? 'Presupuesto de' : 'Asignar límite a') + ' «' + cat.nombre + '»',
    html:
      Campos.monto({ id: idMonto, etiqueta: 'Límite mensual',
                     valor: cat.presupuestado || '', autofoco: true }) +
      Campos.interruptor({ id: idRecurrente, texto: 'Repetir cada mes',
                           valor: cat.es_recurrente === true }) +
      '<button class="btn btn-primario btn-bloque pulsable" style="margin-top:var(--sp-4)" ' +
        'data-guardar>' + (editando ? 'Guardar' : 'Asignar') + '</button>' +
      (editando
        ? '<button class="btn btn-secundario btn-bloque pulsable" style="margin-top:var(--sp-2)" ' +
          'data-quitar>Quitar límite</button>'
        : ''),
    alAbrir: function (raiz) {
      Campos.conectar(raiz);
      raiz.addEventListener('click', async function (e) {
        if (e.target.closest('[data-guardar]')) {
          const monto = Campos.valor(raiz, idMonto);
          if (!monto || monto <= 0) {
            return UI.avisar('Indica un límite mayor a cero.', { error: true });
          }
          hoja.cerrar();
          await guardarLimite(cat.id_categoria, monto, Campos.valor(raiz, idRecurrente));
          return;
        }
        if (e.target.closest('[data-quitar]')) {
          hoja.cerrar();
          await guardarLimite(cat.id_categoria, 0, false);
        }
      });
    }
  });
}

/**
 * Detalle simplificado: cifras del periodo y los movimientos de la categoría. La
 * evolución mensual y el desglose por subcategoría (Manual 1 §8.4) quedan para un
 * paso posterior — no bloquean lo esencial de la pantalla.
 */
async function abrirDetalleCategoria(idCategoria) {
  const cat = categoriaPorId(idCategoria);
  if (!cat) return;
  const m = Formularios.catalogos().config.moneda_base;

  const hoja = UI.abrirHoja({
    titulo: cat.nombre,
    html: '<div class="pila pila-1" style="margin-bottom:var(--sp-5)">' +
        filaDetallePres('Gastado', UI.monto(cat.gastado, m, { sinSigno: true })) +
        filaDetallePres('Presupuestado', UI.monto(cat.presupuestado, m, { sinSigno: true })) +
        filaDetallePres(cat.excedido ? 'Exceso' : 'Restante',
          UI.monto(cat.excedido ? cat.exceso : cat.restante, m, { sinSigno: true })) +
      '</div>' +
      '<button class="btn btn-secundario btn-bloque pulsable" data-al="editar" ' +
        'style="margin-bottom:var(--sp-5)">' + UI.ico('pencil', 'ico-16') + 'Editar límite</button>' +
      '<h3 class="t-overline txt-2" style="margin-bottom:var(--sp-2)">Movimientos del periodo</h3>' +
      '<div class="pila" data-movs><div class="hueso" style="height:52px"></div></div>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', function (e) {
        if (e.target.closest('[data-al="editar"]')) {
          hoja.cerrar();
          abrirAsignarLimite(cat);
        }
      });
      cargarMovimientosCategoria(raiz, idCategoria, m);
    }
  });
}

async function cargarMovimientosCategoria(raiz, idCategoria, m) {
  const zona = raiz.querySelector('[data-movs]');
  try {
    const r = await Api.llamar('movimientos.listar',
      { periodo: Pres.est.periodo, id_categoria: idCategoria, por_pagina: 20 });
    if (!zona.isConnected) return;
    if (!r.movimientos.length) {
      zona.innerHTML = '<p class="t-caption txt-3">Sin movimientos en este periodo.</p>';
      return;
    }
    zona.innerHTML = r.movimientos.map(function (mv) {
      return '<div class="fila-entre detalle-fila">' +
        '<span class="t-label txt-2">' + UI.esc(mv.comercio || '') + '</span>' +
        '<span class="t-label num">' + UI.monto(mv.importe_base, m, { sinSigno: true }) +
        '</span></div>';
    }).join('');
  } catch (e) { if (zona.isConnected) zona.innerHTML = ''; }
}

function filaDetallePres(etiqueta, valor) {
  return '<div class="fila-entre detalle-fila"><span class="t-label txt-2">' +
    UI.esc(etiqueta) + '</span><span class="t-label num">' + valor + '</span></div>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERIODO (§8.1, mismo gesto que Inicio)
// ═══════════════════════════════════════════════════════════════════════════════

function gestoPeriodo(hero) {
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
    cambiarPeriodoPres(dx < 0 ? 1 : -1);
  });
  hero.addEventListener('pointercancel', function () { capturado = false; });
}

function cambiarPeriodoPres(delta) {
  const p = String(Pres.est.periodo || '').split('-');
  if (p.length !== 2) return;
  const d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
  const nuevo = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

  const hoy = new Date();
  const tope = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  if (nuevo > tope) return;

  Pres.est.periodo = nuevo;
  App.recargar();
}

const MESES_PRES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                     'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function nombrePeriodoPres(periodo) {
  const p = String(periodo).split('-');
  const mes = MESES_PRES[Number(p[1]) - 1];
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
  '<div class="pila pila-3" style="margin-top:var(--sp-4)">' + UI.huesosFilas(4) + '</div>';
}

function pintarVacio(vista) {
  vista.innerHTML = UI.vacio({
    icono: 'chart-pie',
    titulo: 'Todavía no hay nada que repartir',
    texto: 'Registra un gasto o asigna un límite a una categoría para empezar.',
    cta: { texto: 'Registrar un movimiento', accion: 'registrar' }
  });
  if (vista._vacioConectado) return;
  vista._vacioConectado = true;
  vista.addEventListener('click', function (e) {
    if (e.target.closest('[data-accion="registrar"]')) document.getElementById('fab').click();
  });
}

/** §10.2: stagger de 50ms. */
function escalonar(vista) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  vista.querySelectorAll('[data-lista] > .tarjeta').forEach(function (c, i) {
    c.style.animationDelay = Math.min(i * 50, 200) + 'ms';
    c.classList.add('entra');
  });
}

})();
