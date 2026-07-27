/**
 * SOLVO — Pantalla Inicio (versión del Paso 9).
 * Manual 1 §8.1 · Manual 3 §7.1, §7.4, §7.5, §7.6, §11.
 *
 * Está aquí por una razón concreta: es la prueba de que la cadena completa funciona.
 * Token de Google → verificación en Solvo → veredicto del Guardián → ruta del Router →
 * agregado sobre el Sheet → render. Un cascarón con cinco pantallas de relleno se ve
 * bonito y no demuestra nada.
 *
 * El Inicio completo —carruseles de insights y pendientes, próximos pagos, calendario—
 * llega en el Paso 10 con la pantalla de Movimientos.
 */
App.registrar('inicio', async function (vista) {
  vista.innerHTML = UI.huesoHero() +
    '<div class="tarjeta pila pila-3">' + UI.huesosFilas(4) + '</div>';

  const d = await Api.llamar('inicio.resumen', {}, { clave: 'inicio' });

  if (d.sin_datos) {
    vista.innerHTML = UI.vacio({
      icono: 'sparkles',
      titulo: 'Empecemos por lo primero',
      texto: 'Registra tu primer movimiento y aquí verás en qué se te va el mes.',
      cta: { texto: 'Registrar', accion: 'registrar' }
    });
    const b = vista.querySelector('[data-accion="registrar"]');
    if (b) b.addEventListener('click', function () { document.getElementById('fab').click(); });
    return;
  }

  const h = d.hero;
  const m = d.moneda_base;

  vista.innerHTML =
    heroHtml(d, h, m) +
    (h.presupuesto && h.presupuesto.configurado ? barraPresupuesto(h.presupuesto, m) : '') +
    (d.movimientos_recientes ? recientes(d.movimientos_recientes, m) : '') +
    resumenSecciones(d);

  // §10.2: el contador interpola en 300ms. La cifra ya está pintada con su valor final, así
  // que si la animación no llega a correr —pestaña en segundo plano, donde rAF no se
  // ejecuta— el usuario ve el número correcto igualmente.
  const cifra = vista.querySelector('[data-cifra]');
  if (cifra) { cifra.dataset.valor = '0'; UI.animarCifra(cifra, h.gasto_total, m); }
});

/** El hero: la cifra protagonista y su píldora de variación (§1.3, §7.5). */
function heroHtml(d, h, m) {
  const v = h.variacion_gasto;
  return '<section class="tarjeta pila pila-2">' +
    '<div class="fila-entre">' +
      '<span class="t-overline txt-2">Gasto de ' + UI.esc(nombrePeriodo(d.periodo)) + '</span>' +
      // `buena_noticia` lo decide el servidor: en gastos bajar es bueno, y el color de la
      // píldora sigue ese dato, no el signo (§7.5).
      (v ? pildoraDesdeVariacion(v) : '<span class="pildora pildora-neutra">1er periodo</span>') +
    '</div>' +
    '<p class="t-display-xl num" data-cifra>' + UI.monto(h.gasto_total, m, { sinSigno: true }) +
    '</p>' +
    '<div class="fila" style="gap:var(--sp-4)">' +
      miniDato('Ingresos', UI.monto(h.ingreso_total, m, { sinSigno: true })) +
      miniDato('Neto', (h.neto >= 0 ? '+ ' : '− ') +
               UI.monto(Math.abs(h.neto), m, { sinSigno: true }),
               h.neto >= 0 ? 'pos' : 'neg') +
    '</div>' +
  '</section>';
}

function pildoraDesdeVariacion(v) {
  const pct = Math.abs(Number(v.porcentaje) * 100);
  const clase = v.buena_noticia === null ? 'pildora-neutra'
              : (v.buena_noticia ? 'pildora-pos' : 'pildora-neg');
  const flecha = v.direccion === 'IGUAL' ? ''
               : UI.ico(v.direccion === 'SUBE' ? 'arrow-up-right' : 'arrow-down-left');
  return '<span class="pildora ' + clase + '" title="frente a ' + UI.esc(v.vs_periodo) + '">' +
         flecha + pct.toFixed(pct < 10 ? 1 : 0).replace('.0', '') + '%</span>';
}

function miniDato(etiqueta, valor, clase) {
  return '<div class="pila">' +
           '<span class="t-caption txt-2">' + UI.esc(etiqueta) + '</span>' +
           '<span class="t-amount num ' + (clase || '') + '">' + UI.esc(valor) + '</span>' +
         '</div>';
}

/** Barra de progreso del presupuesto (§7.6). El color lo decide `nivel`, no el porcentaje. */
function barraPresupuesto(p, m) {
  const pct = Math.min(100, Math.max(0, Number(p.porcentaje) * 100));
  const color = { OK: 'var(--positive)', AVISO: 'var(--warning)', EXCEDIDO: 'var(--negative)' }
                [p.nivel] || 'var(--accent)';
  return '<section class="tarjeta pila pila-3">' +
    '<div class="fila-entre">' +
      '<span class="t-card-title">Presupuesto</span>' +
      '<span class="t-label txt-2 num">' + UI.monto(p.gastado, m, { sinSigno: true }) +
        ' de ' + UI.monto(p.total, m, { sinSigno: true }) + '</span>' +
    '</div>' +
    // §7.6: crece con scaleX en 500ms. Es una ANIMACIÓN, no una transición liberada por
    // rAF: el elemento nace ya en su estado final, así que en una pestaña que no compone
    // fotogramas la barra aparece llena en vez de quedarse en cero para siempre.
    '<div class="pista-progreso">' +
      '<div class="relleno-progreso" style="width:' + pct.toFixed(1) + '%;' +
        'background:' + color + '"></div>' +
    '</div>' +
    '<span class="t-caption txt-2">' +
      (p.restante >= 0
        ? 'Te quedan ' + UI.monto(p.restante, m, { sinSigno: true })
        : 'Te has pasado ' + UI.monto(Math.abs(p.restante), m, { sinSigno: true })) +
    '</span>' +
  '</section>';
}

/** Fila de movimiento (§7.4): ícono de categoría, nombre a la izquierda, monto a la derecha. */
function recientes(items, m) {
  return '<section class="tarjeta pila pila-3">' +
    '<div class="fila-entre">' +
      '<h2 class="t-card-title">Recientes</h2>' +
      '<button class="btn-icono pulsable" onclick="App.ir(\'movimientos\')" ' +
        'aria-label="Ver todos los movimientos">' + UI.ico('chevron-right') + '</button>' +
    '</div>' +
    '<ul class="pila">' + items.slice(0, 6).map(function (x) {
      const gasto = x.tipo === 'GASTO';
      return '<li class="fila" style="min-height:56px">' +
        '<span class="ico-cat" style="--color-cat:' + UI.esc(x.color) + '">' +
          UI.ico(x.icono) + '</span>' +
        '<span class="crece pila">' +
          '<span class="t-card-title recorta">' + UI.esc(x.comercio || x.categoria) + '</span>' +
          '<span class="t-caption txt-2 recorta">' +
            UI.esc([x.categoria, x.cuota && 'cuota ' + x.cuota,
                    x.n_responsables > 1 && 'compartido'].filter(Boolean).join(' · ')) +
          '</span>' +
        '</span>' +
        // §3.3: el signo va pegado al número y siempre presente. El color acompaña, no informa.
        '<span class="t-amount num ' + (gasto ? 'neg' : 'pos') + '" ' +
          'style="text-align:right">' +
          (gasto ? '− ' : '+ ') + UI.monto(x.importe, x.moneda, { sinSigno: true }) +
        '</span>' +
      '</li>';
    }).join('') + '</ul>' +
  '</section>';
}

/**
 * Lo que el servidor manda y esta versión todavía no pinta. Se declara en vez de ignorarse:
 * así el Paso 10 tiene la lista de lo que falta y el usuario ve que sus datos están ahí.
 */
function resumenSecciones(d) {
  const partes = [];
  if (d.insights) partes.push(d.insights.length + ' insights');
  if (d.pendientes_registro) partes.push(d.pendientes_registro.items.length + ' por registrar');
  if (d.proximos_pagos) partes.push(d.proximos_pagos.items.length + ' pagos próximos');
  if (d.acciones_pendientes) partes.push(d.acciones_pendientes + ' acciones');
  if (!partes.length) return '';

  return '<section class="tarjeta tarjeta-plana fila">' +
    '<span class="ico-cat" style="--color-cat:var(--cat-indigo)">' +
      UI.ico('sparkles') + '</span>' +
    '<span class="crece pila">' +
      '<span class="t-label">' + UI.esc(partes.join(' · ')) + '</span>' +
      '<span class="t-caption txt-2">Se pintan en el Paso 10.</span>' +
    '</span>' +
  '</section>';
}

/** «2026-07» → «julio». El año solo si no es el actual: repetirlo es ruido. */
function nombrePeriodo(periodo) {
  const partes = String(periodo).split('-');
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const mes = meses[Number(partes[1]) - 1] || periodo;
  const anio = Number(partes[0]);
  return anio === new Date().getFullYear() ? mes : mes + ' ' + anio;
}
