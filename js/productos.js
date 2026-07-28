/**
 * SOLVO — Pantalla Productos, completa. Manual 1 §8.5 · Manual 4 §E.2 · Manual 5 §C.
 *
 * Responde a «¿cuánto tengo y dónde está?». Hero de patrimonio neto, y una sección por
 * tipo de producto que **solo existe si tiene contenido** (§1.3.2): sin préstamos no hay
 * bloque de préstamos, no un bloque vacío.
 *
 * Todo el archivo vive en un IIFE por lo mismo que el resto de pantallas (ver
 * `docs/PASO-13-DASHBOARD.md` y el §1.D de `TRASPASO.md`): una `function` de nivel
 * superior en un script clásico es global para toda la página, y dos pantallas con una
 * función del mismo nombre se pisan en silencio.
 *
 * **Revelación progresiva (§1.3 principio 6):** tocar una fila abre su detalle en una
 * hoja (Capa 2); `Editar` desde ahí abre el formulario a pantalla completa (Capa 3). No
 * hay swipe-para-editar aquí como en Movimientos — con cuatro tipos de fila distintos,
 * cuatro zonas de gesto sería más código para la misma tarea que ya resuelve un toque.
 */
(function () {

App.registrar('productos', async function (vista) {
  vista.innerHTML = esqueleto();
  let ultimoD = null;
  let variacionActual = null;

  // La variación del patrimonio (`dashboard.datos`, 2 meses) es un extra que NO debe
  // retrasar lo principal: se pide aparte, y si llega —o llega tarde— se repinta
  // encima de lo que ya esté en pantalla. Si falla, la cifra se ve igual, sin píldora.
  Api.llamar('dashboard.datos', { meses: 2 }, { clave: 'productos-var' })
    .then(function (r) {
      variacionActual = r.g3_patrimonio;
      if (ultimoD && variacionActual) { pintar(vista, ultimoD, variacionActual); conectar(vista); }
    })
    .catch(function () { /* sin variación, la cifra sigue mostrándose igual */ });

  // `Api.leer` pinta al instante lo último guardado en este teléfono y otra vez cuando
  // responde el servidor (docs/TRASPASO.md §1.H/I) — por eso puede llamar a esta
  // función dos veces, y por eso `conectar` está protegido para engancharse una sola.
  await Api.leer('productos.listar', {}, { clave: 'productos' }, function (d) {
    ultimoD = d;
    pintar(vista, d, variacionActual);
    conectar(vista);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PINTADO
// ═══════════════════════════════════════════════════════════════════════════════

function pintar(vista, d, variacion) {
  const m = d.moneda_base;
  const vacio = !d.cuentas && !d.tarjetas && !d.prestamos && !d.inversiones && !d.objetivos;

  if (vacio) { pintarVacio(vista); return; }

  vista.innerHTML =
    filaAgregar() +
    heroPatrimonio(d.patrimonio, variacion, m) +
    (d.cuentas ? bloqueCuentas(d.cuentas.items, d.cuentas.total, m) : '') +
    (d.tarjetas ? bloqueTarjetas(d.tarjetas.items, m) : '') +
    (d.prestamos ? bloquePrestamos(d.prestamos.items, m) : '') +
    (d.inversiones ? bloqueInversiones(d.inversiones.items, m) : '') +
    (d.objetivos ? bloqueObjetivosResumen(d.objetivos, m) : '');
}

function filaAgregar() {
  return '<div class="fila-entre" style="margin-bottom:var(--sp-1)">' +
    '<span class="t-overline txt-2">Tus productos</span>' +
    '<button class="btn-icono pulsable" data-al="agregar" aria-label="Agregar producto">' +
      UI.ico('plus') + '</button>' +
  '</div>';
}

/** §8.5: patrimonio neto como cifra principal, con activos y pasivos debajo. */
function heroPatrimonio(p, variacion, m) {
  const pct = variacion && variacion.variacion_pct;
  return '<section class="tarjeta hero-patrimonio">' +
    '<span class="t-overline txt-2">Patrimonio neto</span>' +
    '<div class="fila" style="align-items:baseline;gap:var(--sp-3);flex-wrap:wrap;' +
      'margin-top:var(--sp-1)">' +
      '<span class="t-display-xl num ' + (p.neto < 0 ? 'neg' : '') + '">' +
        UI.monto(p.neto, m, { sinSigno: true, sinDecimales: true }) + '</span>' +
      (pct != null
        ? '<span class="pildora ' + (variacion.variacion >= 0 ? 'pildora-pos' : 'pildora-neg') +
          '">' + UI.ico(variacion.variacion >= 0 ? 'arrow-up-right' : 'arrow-down-left') +
          Math.abs(pct * 100).toFixed(1).replace(/\.0$/, '') + '%</span>'
        : '') +
    '</div>' +
    '<div class="fila-entre" style="margin-top:var(--sp-3)">' +
      '<span class="t-caption txt-2">Activos ' +
        UI.monto(p.activos, m, { sinSigno: true }) + '</span>' +
      '<span class="t-caption txt-2">Pasivos ' +
        UI.monto(p.pasivos, m, { sinSigno: true }) + '</span>' +
    '</div>' +
  '</section>';
}

function cabeceraSeccion(titulo, total, m) {
  return '<div class="fila-entre seccion-cab">' +
    '<h2 class="t-card-title">' + UI.esc(titulo) + '</h2>' +
    (total !== undefined
      ? '<span class="t-label num txt-2">' + UI.monto(total, m, { sinSigno: true }) + '</span>'
      : '') +
  '</div>';
}

function bloqueCuentas(cuentas, total, m) {
  return '<section class="seccion">' +
    cabeceraSeccion('Cuentas', total, m) +
    '<div class="tarjeta pila">' + cuentas.map(function (c) {
      return '<button class="fila fila-producto pulsable" data-detalle="CUENTA:' +
        UI.esc(c.id_cuenta) + '">' +
        '<span class="ico-cat" style="--color-cat:' + UI.esc(c.color || '#8D8D8D') + '">' +
          UI.ico(c.icono) + '</span>' +
        '<span class="crece pila" style="text-align:left">' +
          '<span class="t-card-title recorta">' + UI.esc(c.nombre) + '</span>' +
          '<span class="t-caption txt-2 recorta">' +
            UI.esc([c.banco, c.moneda, c.numero_final && '•••' + c.numero_final]
                   .filter(Boolean).join(' · ')) + '</span>' +
        '</span>' +
        '<span class="t-amount num ' + (c.saldo < 0 ? 'neg' : '') + '">' +
          (c.saldo < 0 ? '− ' : '') + UI.monto(c.saldo, c.moneda, { sinSigno: true }) + '</span>' +
      '</button>';
    }).join('') + '</div>' +
  '</section>';
}

function bloqueTarjetas(tarjetas, m) {
  return '<section class="seccion">' +
    '<div class="fila-entre seccion-cab"><h2 class="t-card-title">Tarjetas</h2></div>' +
    tarjetas.map(function (t) {
      const pct = Math.min(100, Math.max(0, (Number(t.utilizacion) || 0) * 100));
      const color = { BAJO: 'var(--positive)', MEDIO: 'var(--warning)', ALTO: 'var(--negative)' }
                    [t.nivel_utilizacion] || 'var(--accent)';
      return '<button class="tarjeta pila pila-3 pulsable" style="width:100%;text-align:left" ' +
        'data-detalle="TARJETA:' + UI.esc(t.id_tarjeta) + '">' +
        '<div class="fila">' +
          '<span class="ico-cat" style="--color-cat:' + UI.esc(t.color || '#8D8D8D') + '">' +
            UI.ico('credit-card') + '</span>' +
          '<span class="crece pila">' +
            '<span class="t-card-title recorta">' + UI.esc(t.nombre) + '</span>' +
            '<span class="t-caption txt-2 recorta">' +
              UI.esc([t.banco, t.marca, t.numero_final && '•••' + t.numero_final]
                     .filter(Boolean).join(' · ')) + '</span>' +
          '</span>' +
          '<span class="pila" style="text-align:right">' +
            '<span class="t-caption txt-2">Deuda</span>' +
            '<span class="t-amount num ' + (t.deuda > 0 ? 'neg' : '') + '">' +
              UI.monto(t.deuda, t.moneda, { sinSigno: true }) + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="pista-progreso">' +
          '<div class="relleno-progreso" style="width:' + pct.toFixed(1) +
            '%;background:' + color + '"></div>' +
        '</div>' +
        '<div class="fila-entre">' +
          '<span class="t-caption txt-2 num">Disponible ' +
            UI.monto(t.disponible, t.moneda, { sinSigno: true }) + '</span>' +
          '<span class="t-caption txt-2">' + Math.round(pct) + '% usado</span>' +
        '</div>' +
        (t.proximo_pago
          ? '<div class="fila-entre" style="border-top:1px solid var(--border);' +
              'padding-top:var(--sp-3)">' +
              '<span class="t-caption txt-2">Cierra ' + UI.esc(fechaCorta(t.proximo_cierre)) +
                (t.cierre_ajustado ? ' *' : '') + '</span>' +
              '<span class="t-caption txt-2">Paga ' + UI.esc(fechaCorta(t.proximo_pago)) +
                (t.pago_ajustado ? ' *' : '') + '</span>' +
            '</div>' +
            (t.cierre_ajustado || t.pago_ajustado
              ? '<span class="t-caption txt-3">* ' +
                UI.esc(t.motivo_pago || t.motivo_cierre) + '</span>'
              : '')
          : '') +
      '</button>';
    }).join('') +
  '</section>';
}

function bloquePrestamos(prestamos, m) {
  return '<section class="seccion">' +
    '<div class="fila-entre seccion-cab"><h2 class="t-card-title">Préstamos</h2></div>' +
    prestamos.map(function (l) {
      const total = l.cuotas_restantes + l.cuotas_pagadas;
      const pct = total ? (l.cuotas_pagadas / total) * 100 : 0;
      return '<button class="tarjeta pila pila-3 pulsable" style="width:100%;text-align:left" ' +
        'data-detalle="PRESTAMO:' + UI.esc(l.id_prestamo) + '">' +
        '<div class="fila">' +
          '<span class="ico-cat" style="--color-cat:' + UI.esc(l.color || '#8D8D8D') + '">' +
            UI.ico('landmark') + '</span>' +
          '<span class="crece pila">' +
            '<span class="t-card-title recorta">' + UI.esc(l.nombre) + '</span>' +
            '<span class="t-caption txt-2 recorta">' +
              UI.esc([l.entidad, l.cuotas_restantes + ' cuotas restantes']
                     .filter(Boolean).join(' · ')) + '</span>' +
          '</span>' +
          '<span class="pila" style="text-align:right">' +
            '<span class="t-caption txt-2">Saldo</span>' +
            '<span class="t-amount num neg">' +
              UI.monto(l.saldo_pendiente, l.moneda, { sinSigno: true }) + '</span>' +
          '</span>' +
        '</div>' +
        (total ? '<div class="pista-progreso"><div class="relleno-progreso" style="width:' +
          pct.toFixed(1) + '%;background:var(--accent)"></div></div>' : '') +
        '<div class="fila-entre">' +
          '<span class="t-caption txt-2 num">Cuota ' +
            UI.monto(l.cuota_mensual, l.moneda, { sinSigno: true }) + '</span>' +
          (l.proximo_vencimiento
            ? '<span class="t-caption txt-2">Próxima ' +
              UI.esc(fechaCorta(l.proximo_vencimiento)) + '</span>'
            : (l.tiene_cronograma ? '' : '<span class="t-caption warn">Sin cronograma</span>')) +
        '</div>' +
      '</button>';
    }).join('') +
  '</section>';
}

function bloqueInversiones(inversiones, m) {
  return '<section class="seccion">' +
    '<div class="fila-entre seccion-cab"><h2 class="t-card-title">Inversiones</h2></div>' +
    '<div class="tarjeta pila">' + inversiones.map(function (i) {
      const info = infoTipoActivo(i.tipo_activo);
      const gananciaPos = i.ganancia >= 0;
      return '<button class="fila fila-producto pulsable" data-detalle="INVERSION:' +
        UI.esc(i.id_inversion) + '">' +
        '<span class="ico-cat" style="--color-cat:' + UI.esc(i.color || info[3]) + '">' +
          UI.ico(info[2]) + '</span>' +
        '<span class="crece pila" style="text-align:left">' +
          '<span class="t-card-title recorta">' + UI.esc(i.nombre) + '</span>' +
          '<span class="t-caption ' + (gananciaPos ? 'pos' : 'neg') + '">' +
            (gananciaPos ? '+' : '') +
            (i.rentabilidad * 100).toFixed(1) + '%</span>' +
        '</span>' +
        '<span class="t-amount num">' +
          UI.monto(i.valor_actual, i.moneda, { sinSigno: true }) + '</span>' +
      '</button>';
    }).join('') + '</div>' +
  '</section>';
}

/** Tarjeta resumen: la lista completa vive en su propia pantalla (§8.6). */
function bloqueObjetivosResumen(o, m) {
  return '<section class="seccion">' +
    '<button class="tarjeta fila pulsable" style="width:100%;text-align:left" ' +
      'data-al="objetivos">' +
      '<span class="ico-cat" style="--color-cat:var(--cat-indigo)">' + UI.ico('target') +
      '</span>' +
      '<span class="crece pila">' +
        '<span class="t-card-title">Objetivos</span>' +
        '<span class="t-caption txt-2">' +
          o.activos + ' activo' + (o.activos === 1 ? '' : 's') +
          (o.alcanzados ? ' · ' + o.alcanzados + ' alcanzado' + (o.alcanzados === 1 ? '' : 's')
                        : '') +
        '</span>' +
      '</span>' +
      '<span class="pila" style="text-align:right">' +
        '<span class="t-caption txt-2">Ahorrado</span>' +
        '<span class="t-amount num">' + UI.monto(o.total, m, { sinSigno: true }) + '</span>' +
      '</span>' +
      UI.ico('chevron-right') +
    '</button>' +
  '</section>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Delegado en `vista`, así que solo hace falta engancharlo UNA VEZ por montaje de
 * pantalla — `Api.leer` (y la variación de patrimonio que llega por su cuenta) pueden
 * llamar a quien invoca esto varias veces, y sin este guardado cada repintado
 * duplicaría el listener y cada tap dispararía la acción tantas veces como pintadas.
 */
function conectar(vista) {
  if (vista._conectado) return;
  vista._conectado = true;

  vista.addEventListener('click', async function (e) {
    if (e.target.closest('[data-al="agregar"]')) return abrirSelectorTipo();
    if (e.target.closest('[data-al="objetivos"]')) return App.ir('objetivos');

    const det = e.target.closest('[data-detalle]');
    if (det) return abrirDetalle(det.dataset.detalle);
  });
}

/** §8.5: «+ en el header → selector de tipo de producto → formulario de creación». */
function abrirSelectorTipo() {
  const opciones = [
    { tipo: 'cuenta', texto: 'Cuenta', icono: 'wallet', color: 'var(--cat-indigo)' },
    { tipo: 'tarjeta', texto: 'Tarjeta', icono: 'credit-card', color: 'var(--cat-rojo)' },
    { tipo: 'prestamo', texto: 'Préstamo', icono: 'landmark', color: 'var(--cat-rosa)' },
    { tipo: 'inversion', texto: 'Inversión', icono: 'chart-candlestick', color: 'var(--accent)' }
  ];
  const hoja = UI.abrirHoja({
    titulo: 'Agregar producto',
    html: '<ul class="pila pila-2">' + opciones.map(function (o) {
      return '<li><button type="button" class="fila pulsable fila-opcion" data-tipo="' +
        o.tipo + '">' +
        '<span class="ico-cat" style="--color-cat:' + o.color + '">' + UI.ico(o.icono) +
        '</span><span class="crece t-card-title" style="text-align:left">' + o.texto +
        '</span>' + UI.ico('chevron-right') + '</button></li>';
    }).join('') + '</ul>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', async function (e) {
        const b = e.target.closest('[data-tipo]');
        if (!b) return;
        hoja.cerrar();
        try { await App.abrirFormulario(b.dataset.tipo); }
        catch (err) { UI.avisarError(err); }
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETALLE (Capa 2 — §1.3 principio 6) Y EDICIÓN/ARCHIVADO
// ═══════════════════════════════════════════════════════════════════════════════

async function abrirDetalle(clave) {
  const p = clave.split(':');
  const tipo = p[0], id = p[1];
  const cerrarAviso = UI.avisar('Abriendo…', { ms: 6000 });
  let d;
  try {
    d = await Api.llamar('productos.detalle', { tipo_producto: tipo, id_producto: id });
  } catch (e) { cerrarAviso(); return UI.avisarError(e); }
  cerrarAviso();

  d.tipo_producto = tipo; d.id_producto = id;
  const hoja = UI.abrirHoja({
    titulo: d.nombre,
    html: detalleHtml(tipo, d),
    alAbrir: function (raiz) {
      raiz.addEventListener('click', async function (e) {
        if (e.target.closest('[data-al="editar"]')) {
          hoja.cerrar();
          try { await App.abrirFormulario(tipo.toLowerCase(), d); }
          catch (err) { UI.avisarError(err); }
          return;
        }
        if (e.target.closest('[data-al="archivar"]')) {
          hoja.cerrar();
          archivarProducto(tipo, id, d.nombre);
        }
      });
    }
  });
}

function detalleHtml(tipo, d) {
  const filas = [];
  function fila(etiqueta, valor) {
    if (valor === '' || valor == null) return;
    filas.push('<div class="fila-entre detalle-fila"><span class="t-label txt-2">' +
      UI.esc(etiqueta) + '</span><span class="t-label" style="text-align:right">' + valor +
      '</span></div>');
  }

  if (tipo === 'CUENTA') {
    fila('Saldo', '<b class="num">' + UI.monto(d.saldo, d.moneda, { sinSigno: true }) + '</b>');
    fila('Banco', UI.esc(d.banco || ''));
    fila('Tipo', UI.esc(nombreTipoCuenta(d.tipo_cuenta)));
    fila('Moneda', UI.esc(d.moneda));
    fila('En el patrimonio', d.incluir_en_patrimonio ? 'Sí' : 'No');
  } else if (tipo === 'TARJETA') {
    fila('Deuda', '<b class="num neg">' + UI.monto(d.deuda, d.moneda, { sinSigno: true }) +
      '</b>');
    fila('Disponible', UI.monto(d.disponible, d.moneda, { sinSigno: true }));
    fila('Línea de crédito', UI.monto(d.linea_credito, d.moneda, { sinSigno: true }));
    fila('Utilización', Math.round(d.utilizacion * 100) + '%');
    if (d.proximas_fechas && d.proximas_fechas[0]) {
      fila('Próximo cierre', UI.esc(fechaCorta(d.proximas_fechas[0].cierre)));
      fila('Próximo pago', UI.esc(fechaCorta(d.proximas_fechas[0].pago)));
    }
    if (d.cuotas_pendientes && d.cuotas_pendientes.length) {
      fila('Cuotas por facturar', String(d.cuotas_pendientes.reduce(function (s, c) {
        return s + c.restantes; }, 0)));
    }
  } else if (tipo === 'PRESTAMO') {
    fila('Saldo pendiente', '<b class="num neg">' +
      UI.monto(d.saldo_pendiente, d.moneda, { sinSigno: true }) + '</b>');
    fila('Cuota mensual', UI.monto(d.cuota_mensual, d.moneda, { sinSigno: true }));
    fila('Cuotas', d.cuotas_pagadas + ' pagadas · ' + d.cuotas_restantes + ' restantes');
    fila('Entidad', UI.esc(d.entidad || ''));
    if (d.aviso) fila('Aviso', '<span class="warn">' + UI.esc(d.aviso) + '</span>');
  } else {
    fila('Valor actual', '<b class="num">' +
      UI.monto(d.valor_actual, d.moneda, { sinSigno: true }) + '</b>');
    fila('Invertido', UI.monto(d.invertido, d.moneda, { sinSigno: true }));
    fila('Ganancia', '<span class="' + (d.ganancia >= 0 ? 'pos' : 'neg') + '">' +
      UI.monto(d.ganancia, d.moneda, { sinSigno: true }) + ' (' +
      (d.rentabilidad * 100).toFixed(1) + '%)</span>');
    fila('Ticker', UI.esc(d.ticker || ''));
  }

  fila('Movimientos', String(d.n_movimientos));

  return '<div class="pila pila-1">' + filas.join('') + '</div>' +
    '<div class="pila pila-2" style="margin-top:var(--sp-5)">' +
      '<button class="btn btn-secundario btn-bloque pulsable" data-al="editar">' +
        UI.ico('pencil', 'ico-16') + 'Editar</button>' +
      '<button class="btn btn-peligro btn-bloque pulsable" data-al="archivar">' +
        UI.ico('trash-2', 'ico-16') + (d.n_movimientos > 0 ? 'Archivar' : 'Eliminar') +
      '</button>' +
    '</div>';
}

function nombreTipoCuenta(t) {
  return { CORRIENTE: 'Corriente', AHORRO: 'Ahorro', EFECTIVO: 'Efectivo',
           BILLETERA: 'Billetera', OTRO: 'Otro' }[t] || t;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTADOS
// ═══════════════════════════════════════════════════════════════════════════════

function esqueleto() {
  return '<div class="tarjeta hero-patrimonio pila pila-2">' +
    '<div class="hueso hueso-linea" style="width:40%"></div>' +
    '<div class="hueso hueso-cifra" style="width:70%"></div>' +
  '</div>' +
  '<div class="tarjeta pila pila-3" style="margin-top:var(--sp-4)">' + UI.huesosFilas(3) + '</div>';
}

function pintarVacio(vista) {
  vista.innerHTML = UI.vacio({
    icono: 'wallet',
    titulo: 'Empieza por tus cuentas',
    texto: 'Añade la cuenta por la que te entra el sueldo y la tarjeta con la que gastas. ' +
           'Sin eso no hay dónde registrar un movimiento.',
    cta: { texto: 'Añadir una cuenta', accion: 'cuenta' }
  });
  vista.querySelector('.vacio').insertAdjacentHTML('beforeend',
    '<button class="btn btn-secundario pulsable" data-accion="tarjeta">' +
    UI.ico('credit-card', 'ico-16') + 'O una tarjeta</button>');

  // Guardado aparte de `_conectado` (que usa el listener de `conectar`): con caché
  // local, `pintar` puede volver a caer aquí en la segunda pintada si el estado
  // seguía vacío, y sin esto el botón dispararía el formulario dos veces.
  if (vista._vacioConectado) return;
  vista._vacioConectado = true;
  vista.addEventListener('click', async function (e) {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    try { await App.abrirFormulario(b.dataset.accion); }
    catch (err) { UI.avisarError(err); }
  });
}

const MESES_P = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCorta(iso) {
  const p = String(iso).split('-');
  if (p.length !== 3) return String(iso);
  return Number(p[2]) + ' ' + (MESES_P[Number(p[1]) - 1] || '');
}

})();
