/**
 * SOLVO — Pantalla Dashboard.
 * Manual 1 §8.3 · Manual 3 §9.6 (G4, G6, G8, G9, G10, G11) · Manual 5 §A.7 (G12 cascada).
 *
 * Responde a «¿qué está pasando con mi dinero, en profundidad?». Ocho bloques en el orden
 * exacto del §8.3 — no se reordenan — más los filtros fijos arriba: periodo, responsable y
 * un tercer filtro (categoría, producto, tipo).
 *
 * Dos de los ocho no usan ECharts a propósito:
 *
 *   · Presupuesto vs. gasto (g7) es una fila por categoría con una barra de fondo/relleno,
 *     igual que la barra de presupuesto de Inicio. Es exactamente el mismo componente y
 *     traerlo como gráfico solo para dibujar un rectángulo sería peor, no mejor.
 *   · Próximos pagos (g5) es una recta de tiempo con marcadores posicionados por fecha en
 *     CSS puro. Un `custom` series de ECharts para esto es más código para el mismo
 *     resultado visual, y aquí no hay tooltip de ejes que justifique la librería.
 *
 * Todo el archivo vive dentro de un IIFE: nombres como `conectar`, `montar`, `pintar` o
 * `escalonar` se repiten en Inicio y Movimientos, y una `function` de nivel superior en un
 * script clásico se cuelga del mismo objeto global para TODOS los `<script>` de la página.
 * Sin el IIFE, esta pantalla —al cargar última— pisaría las de las otras dos y sus gestos
 * dejarían de responder, en silencio.
 */
(function () {

const Dash = (function () {

  const est = {
    periodo: null,        // 'YYYY-MM', el mes final del rango
    meses: 6,
    idsResponsable: [],   // vacío = todos
    idCategoria: '',
    tipoProducto: '',
    idProducto: '',
    tipo: ''
  };

  function parametros() {
    const p = { periodo: est.periodo || undefined, meses: est.meses };
    if (est.idsResponsable.length) p.ids_responsable = est.idsResponsable;
    if (est.idCategoria) p.id_categoria = est.idCategoria;
    if (est.tipoProducto) p.tipo_producto = est.tipoProducto;
    if (est.idProducto) p.id_producto = est.idProducto;
    if (est.tipo) p.tipo = est.tipo;
    return p;
  }

  function nFiltrosActivos() {
    return (est.idCategoria ? 1 : 0) + (est.tipoProducto ? 1 : 0) + (est.tipo ? 1 : 0);
  }

  return { est: est, parametros: parametros, nFiltrosActivos: nFiltrosActivos };
})();

App.registrar('dashboard', async function (vista) {
  const est = Dash.est;

  vista.innerHTML = carrilFiltros() + esqueleto();

  const [cat, d] = await Promise.all([
    Formularios.cargarCatalogos(),
    Api.llamar('dashboard.datos', Dash.parametros(), { clave: 'dashboard' })
  ]);

  est.periodo = est.periodo || d.periodo || cat.periodo_actual;

  await pintar(vista, d);
  conectar(vista, d);
});

// ═══════════════════════════════════════════════════════════════════════════════
// FILTROS FIJOS (§8.3: periodo, responsable, filtros)
// ═══════════════════════════════════════════════════════════════════════════════

function carrilFiltros() {
  const est = Dash.est;
  const n = Dash.nFiltrosActivos();

  return '<div class="carril-chips" data-filtros>' +
    '<button class="chip pulsable" data-al="periodo">' + UI.ico('calendar-range', 'ico-16') +
      '<span data-etiqueta-periodo>' + UI.esc(etiquetaPeriodo(est.periodo, est.meses)) +
      '</span>' + UI.ico('chevron-down', 'ico-16') + '</button>' +
    '<button class="chip pulsable" data-al="responsable" aria-pressed="' +
      (est.idsResponsable.length > 0) + '">' + UI.ico('users', 'ico-16') +
      '<span data-etiqueta-resp>' + UI.esc(
        est.idsResponsable.length ? est.idsResponsable.length + ' responsable' +
        (est.idsResponsable.length > 1 ? 's' : '') : 'Todos') + '</span></button>' +
    '<button class="chip pulsable" data-al="filtros" aria-pressed="' + (n > 0) + '">' +
      UI.ico('list-filter', 'ico-16') + '<span>Filtros' + (n ? ' · ' + n : '') + '</span>' +
    '</button>' +
  '</div>';
}

function etiquetaPeriodo(periodo, meses) {
  if (!periodo) return 'Periodo';
  if (meses <= 1) return nombreMesCorto(periodo) + ' ' + periodo.split('-')[0];
  const inicio = periodoMenos(periodo, meses - 1);
  const mismoAnio = inicio.split('-')[0] === periodo.split('-')[0];
  return nombreMesCorto(inicio) + (mismoAnio ? '' : ' ' + inicio.split('-')[0]) +
         ' – ' + nombreMesCorto(periodo) + ' ' + periodo.split('-')[0];
}

/** §6.2 simplificado: el selector completo de calendario llega con la pantalla de periodo
 *  global. Aquí basta con elegir el mes final y cuántos meses de rango mirar hacia atrás. */
function abrirSelectorPeriodo() {
  const est = Dash.est;
  const opcionesMeses = [3, 6, 12];

  const hoja = UI.abrirHoja({
    titulo: 'Periodo del Dashboard',
    html:
      '<div class="fila-entre" style="margin-bottom:var(--sp-4)">' +
        '<button class="btn-icono pulsable" data-mes="-1" aria-label="Mes anterior">' +
          UI.ico('chevron-left') + '</button>' +
        '<span class="t-card-title" data-mes-actual>' + UI.esc(nombrePeriodoLargo(est.periodo)) +
        '</span>' +
        '<button class="btn-icono pulsable" data-mes="1" aria-label="Mes siguiente" ' +
          (esMesFuturo(est.periodo) ? 'disabled' : '') + '>' + UI.ico('chevron-right') +
        '</button>' +
      '</div>' +
      '<p class="t-overline txt-2" style="margin-bottom:var(--sp-2)">Meses hacia atrás</p>' +
      '<div class="segmentado" data-meses>' + opcionesMeses.map(function (m) {
        return '<button type="button" class="segmento pulsable" data-v="' + m + '" ' +
          'aria-checked="' + (est.meses === m) + '">' + m + ' meses</button>';
      }).join('') + '</div>' +
      '<button class="btn btn-primario btn-bloque pulsable" style="margin-top:var(--sp-5)" ' +
        'data-aplicar>Aplicar</button>',
    alAbrir: function (raiz) {
      let periodo = est.periodo, meses = est.meses;
      raiz.addEventListener('click', function (e) {
        const nav = e.target.closest('[data-mes]');
        if (nav) {
          periodo = periodoMas(periodo, Number(nav.dataset.mes));
          if (esMesFuturo(periodo)) periodo = periodoMas(periodo, -Number(nav.dataset.mes));
          raiz.querySelector('[data-mes-actual]').textContent = nombrePeriodoLargo(periodo);
          raiz.querySelector('[data-mes="1"]').disabled = esMesFuturo(
            periodoMas(periodo, 1));
          return;
        }
        const seg = e.target.closest('[data-meses] .segmento');
        if (seg) {
          meses = Number(seg.dataset.v);
          raiz.querySelectorAll('[data-meses] .segmento').forEach(function (b) {
            b.setAttribute('aria-checked', String(b === seg));
          });
          return;
        }
        if (e.target.closest('[data-aplicar]')) {
          hoja.cerrar();
          est.periodo = periodo; est.meses = meses;
          App.recargar();
        }
      });
    }
  });
}

function abrirSelectorResponsable() {
  const est = Dash.est;
  const rs = (Formularios.catalogos().responsables || []);
  const sel = new Set(est.idsResponsable);

  const hoja = UI.abrirHoja({
    titulo: 'Responsable',
    html:
      '<ul class="pila" data-lista>' +
        '<li><button type="button" class="fila pulsable fila-opcion" data-todos ' +
          'aria-pressed="' + (sel.size === 0) + '">' +
          '<span class="crece t-card-title" style="text-align:left">Todos</span>' +
          '<span class="marca-sel">' + UI.ico('check') + '</span></button></li>' +
        rs.map(function (r) {
          return '<li><button type="button" class="fila pulsable fila-opcion" data-resp="' +
            UI.esc(r.id_responsable) + '" aria-pressed="' + sel.has(r.id_responsable) + '">' +
            '<span class="ico-cat ico-cat-sm" style="--color-cat:' +
              UI.esc(r.color || '#8D8D8D') + '">' + UI.ico('user') + '</span>' +
            '<span class="crece t-card-title recorta" style="text-align:left">' +
              UI.esc(r.nombre) + '</span>' +
            '<span class="marca-sel">' + UI.ico('check') + '</span></button></li>';
        }).join('') +
      '</ul>' +
      '<button type="button" class="btn btn-primario btn-bloque pulsable" ' +
        'style="margin-top:var(--sp-4)" data-confirmar>Aplicar</button>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', function (e) {
        if (e.target.closest('[data-todos]')) { sel.clear(); pintarSel(); return; }
        const b = e.target.closest('[data-resp]');
        if (b) {
          const id = b.dataset.resp;
          if (sel.has(id)) sel.delete(id); else sel.add(id);
          pintarSel();
          return;
        }
        if (e.target.closest('[data-confirmar]')) {
          hoja.cerrar();
          est.idsResponsable = Array.from(sel);
          App.recargar();
        }
      });
      function pintarSel() {
        raiz.querySelector('[data-todos]').setAttribute('aria-pressed', String(sel.size === 0));
        raiz.querySelectorAll('[data-resp]').forEach(function (b) {
          b.setAttribute('aria-pressed', String(sel.has(b.dataset.resp)));
        });
      }
    }
  });
}

function abrirFiltros() {
  const est = Dash.est;

  const hoja = UI.abrirHoja({
    titulo: 'Filtros',
    html:
      '<p class="t-overline txt-2" style="margin-bottom:var(--sp-2)">Tipo de movimiento</p>' +
      '<div class="segmentado" data-tipo style="margin-bottom:var(--sp-5)">' +
        [['', 'Todos'], ['GASTO', 'Gasto'], ['INGRESO', 'Ingreso']].map(function (o) {
          return '<button type="button" class="segmento pulsable" data-v="' + o[0] + '" ' +
            'aria-checked="' + (est.tipo === o[0]) + '">' + o[1] + '</button>';
        }).join('') + '</div>' +
      '<p class="t-overline txt-2" style="margin-bottom:var(--sp-2)">Categoría</p>' +
      '<button type="button" class="campo-selector fila pulsable" data-elegir-cat ' +
        'style="margin-bottom:var(--sp-5)">' +
        '<span class="crece t-body" data-txt-cat>' + UI.esc(
          est.idCategoria ? (Formularios.buscarCategoria(est.idCategoria) || {}).nombre ||
          'Categoría' : 'Todas las categorías') + '</span>' +
        UI.ico('chevron-right') + '</button>' +
      '<p class="t-overline txt-2" style="margin-bottom:var(--sp-2)">Producto</p>' +
      '<button type="button" class="campo-selector fila pulsable" data-elegir-prod ' +
        'style="margin-bottom:var(--sp-5)">' +
        '<span class="crece t-body" data-txt-prod>' + UI.esc(
          est.idProducto ? (Formularios.buscarProducto(est.tipoProducto + ':' + est.idProducto) ||
          {}).nombre || 'Producto' : 'Todos los productos') + '</span>' +
        UI.ico('chevron-right') + '</button>' +
      '<div class="pila pila-2">' +
        '<button class="btn btn-primario btn-bloque pulsable" data-aplicar>Aplicar</button>' +
        (Dash.nFiltrosActivos()
          ? '<button class="btn btn-secundario btn-bloque pulsable" data-limpiar>' +
            'Quitar filtros</button>' : '') +
      '</div>',
    alAbrir: function (raiz) {
      let tipo = est.tipo, idCategoria = est.idCategoria;
      let tipoProducto = est.tipoProducto, idProducto = est.idProducto;

      raiz.addEventListener('click', function (e) {
        const seg = e.target.closest('[data-tipo] .segmento');
        if (seg) {
          tipo = seg.dataset.v;
          raiz.querySelectorAll('[data-tipo] .segmento').forEach(function (b) {
            b.setAttribute('aria-checked', String(b === seg));
          });
          return;
        }
        if (e.target.closest('[data-elegir-cat]')) {
          Formularios.elegirCategoria('GASTO', idCategoria, function (idCat) {
            idCategoria = idCat;
            raiz.querySelector('[data-txt-cat]').textContent =
              (Formularios.buscarCategoria(idCat) || {}).nombre || 'Categoría';
          });
          return;
        }
        if (e.target.closest('[data-elegir-prod]')) {
          Formularios.elegirProducto(false,
            tipoProducto ? tipoProducto + ':' + idProducto : '', function (clave) {
            const p = clave.split(':');
            tipoProducto = p[0]; idProducto = p[1];
            raiz.querySelector('[data-txt-prod]').textContent =
              (Formularios.buscarProducto(clave) || {}).nombre || 'Producto';
          });
          return;
        }
        if (e.target.closest('[data-limpiar]')) {
          tipo = ''; idCategoria = ''; tipoProducto = ''; idProducto = '';
          hoja.cerrar();
          Object.assign(est, { tipo: '', idCategoria: '', tipoProducto: '', idProducto: '' });
          App.recargar();
          return;
        }
        if (e.target.closest('[data-aplicar]')) {
          hoja.cerrar();
          Object.assign(est, { tipo: tipo, idCategoria: idCategoria,
            tipoProducto: tipoProducto, idProducto: idProducto });
          App.recargar();
        }
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOS OCHO BLOQUES, EN ORDEN (§8.3)
// ═══════════════════════════════════════════════════════════════════════════════

async function pintar(vista, d) {
  const m = d.moneda_base;
  vista.innerHTML = carrilFiltros() +
    bloqueFlujo(d.g1_flujo, m) +
    bloqueGastoCategoria(d.g2_gasto_por_categoria, m) +
    bloquePatrimonio(d.g3_patrimonio, m) +
    bloqueGastoPasivos(d.g4_gasto_por_pasivos, m) +
    bloqueTimeline(d.g5_timeline_pagos, m) +
    bloqueHeatmap(d.g6_heatmap_categorias, m) +
    bloquePresupuesto(d.g7_presupuesto_vs_gasto, m) +
    bloqueCascada(d.g8_caja_cascada, m);

  escalonar(vista);
  // Guardado en el propio nodo: `conectar()` lo necesita para escuchar el click nativo de
  // ECharts, y pasa a ser el mismo elemento porque el router lo crea una vez por navegación.
  vista._dashApis = await montarGraficos(vista, d, m);
}

function cabeceraTarjeta(titulo, subtitulo) {
  return '<div class="fila-entre" style="margin-bottom:var(--sp-1)">' +
    '<h3 class="t-card-title">' + UI.esc(titulo) + '</h3>' +
  '</div>' +
  (subtitulo ? '<p class="t-caption txt-2" style="margin-bottom:var(--sp-2)">' +
    UI.esc(subtitulo) + '</p>' : '');
}

/** G1 (Manual 3 G4) · Flujo de dinero: barras + toggle Sankey solo en escritorio (§8.3.1). */
function bloqueFlujo(g, m) {
  if (!g) return '';
  const escritorio = App.plataforma().escritorio;
  const total = g.neto.reduce(function (s, v) { return s + v; }, 0);

  return '<section class="tarjeta seccion-dash" data-bloque="flujo">' +
    cabeceraTarjeta('Flujo de dinero',
      'Neto del rango: ' + UI.monto(total, m, { sinSigno: true })) +
    (escritorio
      ? '<div class="segmentado" data-vista-flujo style="max-width:220px;margin-bottom:var(--sp-3)">' +
        '<button type="button" class="segmento pulsable" data-v="barras" aria-checked="true">' +
          'Barras</button>' +
        '<button type="button" class="segmento pulsable" data-v="sankey" aria-checked="false" ' +
          (g.sankey_disponible ? '' : 'disabled') + '>Sankey</button>' +
      '</div>' : '') +
    '<div class="grafico grafico-dash" data-g="flujo"><div class="grafico-hueso"></div></div>' +
    (escritorio
      ? '<div class="grafico grafico-dash" data-g="sankey" hidden>' +
        '<div class="grafico-hueso"></div></div>' : '') +
    '<button class="enlace-seccion pulsable" data-al="tabla-flujos" ' +
      'style="align-self:flex-end;margin-top:var(--sp-2)">Ver tabla de flujos' +
      UI.ico('chevron-right', 'ico-16') + '</button>' +
  '</section>';
}

/** G2 (Manual 3 G6) · Gasto por categoría: top 5 + «Ver todas» (§8.3.2). */
function bloqueGastoCategoria(g, m) {
  if (!g || !g.top.length) return seccionVacia('Gasto por categoría',
    'Todavía no hay gastos categorizados en este rango.');
  return '<section class="tarjeta seccion-dash" data-bloque="gasto-cat">' +
    cabeceraTarjeta('Gasto por categoría',
      'Total: ' + UI.monto(g.total, m, { sinSigno: true })) +
    '<div class="grafico grafico-dash grafico-lista" data-g="gasto-cat" ' +
      'style="height:' + Math.max(160, g.top.length * 44) + 'px">' +
      '<div class="grafico-hueso"></div></div>' +
    (g.todas.length > g.top.length
      ? '<button class="enlace-seccion pulsable" data-al="todas-categorias" ' +
        'style="align-self:flex-end;margin-top:var(--sp-2)">Ver todas' +
        UI.ico('chevron-right', 'ico-16') + '</button>' : '') +
  '</section>';
}

/** G3 · Evolución del patrimonio (§8.3.3). */
function bloquePatrimonio(g, m) {
  if (!g) return '';
  const pct = g.variacion_pct;
  return '<section class="tarjeta seccion-dash" data-bloque="patrimonio">' +
    cabeceraTarjeta('Evolución del patrimonio') +
    '<div class="hero-cifras" style="grid-template-columns:1fr">' +
      '<span class="cifra-hero num ' + (g.actual >= 0 ? '' : 'neg') + '">' +
        UI.monto(g.actual, m, { sinSigno: true, sinDecimales: true }) + '</span>' +
    '</div>' +
    '<div class="hero-var">' +
      '<span class="pildora ' + (g.variacion >= 0 ? 'pildora-pos' : 'pildora-neg') + '">' +
        UI.ico(g.variacion >= 0 ? 'arrow-up-right' : 'arrow-down-left') +
        (pct == null ? '—' : Math.abs(pct * 100).toFixed(0) + '%') + '</span>' +
      '<span class="t-caption txt-2">' + UI.monto(Math.abs(g.variacion), m, { sinSigno: true }) +
        ' en el rango</span>' +
    '</div>' +
    '<div class="grafico grafico-dash" data-g="patrimonio"><div class="grafico-hueso"></div></div>' +
  '</section>';
}

/** G4 (Manual 3 G8) · Gasto por pasivos: capital / interés / comisiones (§8.3.4). */
function bloqueGastoPasivos(g, m) {
  if (!g || !g.items.length) return seccionVacia('Gasto por pasivos',
    'Sin tarjetas ni préstamos con movimientos en este rango.');
  return '<section class="tarjeta seccion-dash" data-bloque="gasto-pasivos">' +
    cabeceraTarjeta('Gasto por pasivos',
      'Lo que de verdad cuesta la deuda: ' +
      UI.monto(g.total_costo_real, m, { sinSigno: true })) +
    '<div class="grafico grafico-dash grafico-lista" data-g="gasto-pasivos" ' +
      'style="height:' + Math.max(160, g.items.length * 48) + 'px">' +
      '<div class="grafico-hueso"></div></div>' +
    leyendaSimple([['Interés', 'var(--negative)'], ['Comisiones y seguros', 'var(--negative-soft)'],
      ['Capital (no es costo)', 'var(--border-strong)']]) +
  '</section>';
}

/** G5 (Manual 3 G9) · Próximos pagos de pasivos, timeline de 3 meses en CSS (§8.3.5). */
function bloqueTimeline(g, m) {
  if (!g || !g.marcadores.length) return seccionVacia('Próximos pagos de pasivos',
    'Nada vence en los próximos tres meses.');

  const desde = new Date(g.desde + 'T00:00:00');
  const hasta = new Date(g.hasta + 'T00:00:00');
  const totalMs = hasta - desde || 1;
  const meses = mesesEntre(desde, hasta);

  return '<section class="tarjeta seccion-dash" data-bloque="timeline">' +
    cabeceraTarjeta('Próximos pagos de pasivos',
      'Total: ' + UI.monto(g.total, m, { sinSigno: true })) +
    '<div class="timeline" data-timeline>' +
      meses.map(function (mes) {
        const pct = ((mes - desde) / totalMs) * 100;
        return '<div class="timeline-mes" style="left:' + pct.toFixed(2) + '%">' +
          '<span class="t-overline txt-3">' + nombreMesCorto(isoDeFecha(mes)) + '</span></div>';
      }).join('') +
      '<div class="timeline-linea"></div>' +
      g.marcadores.map(function (x, i) {
        const f = new Date(x.fecha + 'T00:00:00');
        const pct = Math.min(100, Math.max(0, ((f - desde) / totalMs) * 100));
        const tam = 10 + (g.monto_maximo > 0 ? (x.monto / g.monto_maximo) * 18 : 0);
        return '<button class="timeline-marca pulsable" data-marca="' + i + '" ' +
          'style="left:' + pct.toFixed(2) + '%;--tam:' + tam.toFixed(0) + 'px;' +
          '--color-marca:' + UI.esc(x.color || 'var(--accent)') + '" ' +
          'aria-label="' + UI.esc(x.nombre) + ', ' + UI.esc(x.fecha) + '"></button>';
      }).join('') +
    '</div>' +
  '</section>';
}

/** G6 (Manual 3 G10) · Heatmap categoría × mes (§8.3.6). */
function bloqueHeatmap(g, m) {
  if (!g || !g.categorias.length) return seccionVacia('Actividad de gastos por categoría',
    'Sin datos suficientes en este rango.');
  return '<section class="tarjeta seccion-dash" data-bloque="heatmap">' +
    cabeceraTarjeta('Actividad de gastos por categoría') +
    '<div class="grafico grafico-dash" data-g="heatmap" ' +
      'style="height:' + Math.max(220, g.categorias.length * 32 + 80) + 'px">' +
      '<div class="grafico-hueso"></div></div>' +
  '</section>';
}

/** G7 (Manual 3 G11) · Presupuesto vs. gasto: filas con barra fondo/relleno (§8.3.7). */
function bloquePresupuesto(g, m) {
  if (!g || !g.filas.length) return seccionVacia('Presupuesto vs. gasto',
    'Configura un presupuesto para ver esta comparación.');
  return '<section class="tarjeta seccion-dash" data-bloque="presupuesto">' +
    cabeceraTarjeta('Presupuesto vs. gasto',
      UI.monto(g.total_gastado, m, { sinSigno: true }) + ' de ' +
      UI.monto(g.total_presupuestado, m, { sinSigno: true })) +
    '<div class="pila pila-3">' + g.filas.map(function (f) {
      const pct = Math.min(100, Math.max(0, f.porcentaje * 100));
      const color = { OK: 'var(--positive)', AVISO: 'var(--warning)',
                      EXCEDIDO: 'var(--negative)' }[f.nivel] || 'var(--accent)';
      return '<button class="presupuesto-fila pulsable" data-categoria="' +
        UI.esc(f.id_categoria) + '">' +
        '<div class="fila-entre">' +
          '<span class="fila" style="gap:var(--sp-2)">' +
            '<span class="ico-cat ico-cat-sm" style="--color-cat:' + UI.esc(f.color) + '">' +
              UI.ico(f.icono) + '</span>' +
            '<span class="t-label">' + UI.esc(f.nombre) + '</span>' +
          '</span>' +
          (f.excedido ? '<span class="pildora pildora-neg">Excedido</span>' : '') +
        '</div>' +
        '<div class="pista-progreso">' +
          '<div class="relleno-progreso" style="width:' + pct.toFixed(1) + '%;background:' +
            color + '"></div>' +
        '</div>' +
        '<span class="t-caption txt-2 num">' + UI.esc(f.etiqueta) + '</span>' +
      '</button>';
    }).join('') + '</div>' +
  '</section>';
}

/** G8 (Manual 3 G12) · Cascada del Control de caja (Manual 5 §A.7). */
function bloqueCascada(g, m) {
  if (!g) return seccionVacia('Control de caja', 'Declara tus conceptos de caja para ver esto.');
  return '<section class="tarjeta seccion-dash" data-bloque="cascada">' +
    cabeceraTarjeta('Control de caja',
      'Disponible: ' + UI.monto(g.disponible, m, { sinSigno: true })) +
    '<div class="grafico grafico-dash" data-g="cascada"><div class="grafico-hueso"></div></div>' +
  '</section>';
}

function seccionVacia(titulo, texto) {
  return '<section class="tarjeta seccion-dash tarjeta-plana">' +
    cabeceraTarjeta(titulo) +
    '<p class="t-caption txt-3">' + UI.esc(texto) + '</p>' +
  '</section>';
}

function leyendaSimple(series) {
  return '<div class="leyenda">' + series.map(function (s) {
    return '<span class="leyenda-item"><i style="background:' + s[1] + '"></i>' +
           UI.esc(s[0]) + '</span>';
  }).join('') + '</div>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONTAJE DE LOS GRÁFICOS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Devuelve las instancias montadas, indexadas por el mismo nombre que su `data-g`. Quien
 * conecta la interacción las necesita para escuchar el `click` NATIVO de ECharts —con el
 * `dataIndex` correcto— en vez de estimar qué barra se tocó a partir de coordenadas de
 * píxel, que se desalinea en cuanto cambia el `grid` o el usuario hace zoom.
 */
async function montarGraficos(vista, d, m) {
  const apis = {};

  async function montarEn(clave, construir) {
    const caja = vista.querySelector('[data-g="' + clave + '"]');
    if (!caja) return;
    try {
      const g = await Graficos.montar(caja, construir);
      if (g) { caja.dataset.listo = 'true'; apis[clave] = g; }
    } catch (e) {
      caja.innerHTML = '<div class="grafico-vacio t-caption txt-3">' + UI.esc(e.message) + '</div>';
    }
  }

  const tareas = [];

  if (d.g1_flujo) {
    const etiquetas = d.g1_flujo.meses.map(nombreMesCorto);
    tareas.push(montarEn('flujo', function () {
      return Graficos.opcionesFlujo(Object.assign({ etiquetas: etiquetas }, d.g1_flujo), m);
    }));
    if (d.g1_flujo.sankey_disponible) {
      tareas.push(montarEn('sankey', function () {
        return Graficos.opcionesSankey(d.g1_flujo.tabla_flujos, m);
      }));
    }
  }

  if (d.g2_gasto_por_categoria && d.g2_gasto_por_categoria.top.length) {
    tareas.push(montarEn('gasto-cat', function () {
      return Graficos.opcionesGastoCategoria(d.g2_gasto_por_categoria.top, m);
    }));
  }

  if (d.g3_patrimonio) {
    const etiquetas = d.g3_patrimonio.meses.map(nombreMesCorto);
    tareas.push(montarEn('patrimonio', function () {
      return Graficos.opcionesPatrimonio(
        Object.assign({ etiquetas: etiquetas }, d.g3_patrimonio), m);
    }));
  }

  if (d.g4_gasto_por_pasivos && d.g4_gasto_por_pasivos.items.length) {
    tareas.push(montarEn('gasto-pasivos', function () {
      return Graficos.opcionesGastoPasivos(d.g4_gasto_por_pasivos.items, m);
    }));
  }

  if (d.g6_heatmap_categorias && d.g6_heatmap_categorias.categorias.length) {
    const etiquetasX = d.g6_heatmap_categorias.meses.map(nombreMesCorto);
    tareas.push(montarEn('heatmap', function () {
      return Graficos.opcionesHeatmap(
        Object.assign({ etiquetasX: etiquetasX }, d.g6_heatmap_categorias), m);
    }));
  }

  if (d.g8_caja_cascada) {
    tareas.push(montarEn('cascada', function () {
      return Graficos.opcionesCascada(d.g8_caja_cascada.barras, m);
    }));
  }

  await Promise.all(tareas);
  return apis;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

function conectar(vista, d) {
  const m = d.moneda_base;
  // `pintar()` ya montó los gráficos (ECharts en diferido, §9.1) y dejó las instancias aquí:
  // el click nativo de ECharts trae el `dataIndex` correcto, sin tener que adivinar qué
  // barra se tocó a partir de coordenadas de píxel.
  const apis = vista._dashApis || {};

  vista.addEventListener('click', function (e) {
    if (e.target.closest('[data-al="periodo"]')) return abrirSelectorPeriodo();
    if (e.target.closest('[data-al="responsable"]')) return abrirSelectorResponsable();
    if (e.target.closest('[data-al="filtros"]')) return abrirFiltros();

    const seg = e.target.closest('[data-vista-flujo] .segmento');
    if (seg) return alternarVistaFlujo(vista, seg);

    if (e.target.closest('[data-al="tabla-flujos"]')) {
      return abrirTablaFlujos(d.g1_flujo, m);
    }
    if (e.target.closest('[data-al="todas-categorias"]')) {
      return abrirTodasCategorias(d.g2_gasto_por_categoria, m);
    }

    const marca = e.target.closest('[data-marca]');
    if (marca) {
      return abrirDetallePago(d.g5_timeline_pagos.marcadores[Number(marca.dataset.marca)], m);
    }

    const filaPres = e.target.closest('[data-categoria]');
    if (filaPres) return UI.avisar('Detalle de categoría llega con la pantalla Presupuesto ' +
      '(Paso 15).');
  });

  if (apis.cascada && d.g8_caja_cascada) {
    // `seriesIndex === 1` es la barra visible; la 0 es el offset transparente y es `silent`,
    // así que ECharts nunca la reporta en el click de todas formas — pero comprobarlo evita
    // sorpresas si en algún momento deja de serlo.
    apis.cascada.inst.on('click', function (params) {
      if (params.seriesIndex !== 1) return;
      const barra = d.g8_caja_cascada.barras[params.dataIndex];
      if (barra) abrirDesgloseCascada(barra, d.g8_caja_cascada.desgloses, m);
    });
  }

  if (apis['gasto-cat'] && d.g2_gasto_por_categoria) {
    apis['gasto-cat'].inst.on('click', function () {
      UI.avisar('Detalle de categoría llega con la pantalla Presupuesto (Paso 15).');
    });
  }

  if (apis['gasto-pasivos'] && d.g4_gasto_por_pasivos) {
    apis['gasto-pasivos'].inst.on('click', function (params) {
      const item = d.g4_gasto_por_pasivos.items[params.dataIndex];
      if (item) abrirDesglosePasivo(item, m);
    });
  }

  if (apis.heatmap && d.g6_heatmap_categorias) {
    apis.heatmap.inst.on('click', function (params) {
      if (!params.value) return;
      abrirDetalleHeatmap(d.g6_heatmap_categorias, params.value[0], params.value[1], m);
    });
  }
}

/** El toggle Barras/Sankey solo existe en escritorio, y el Sankey se monta perezosamente. */
function alternarVistaFlujo(vista, seg) {
  if (seg.disabled) return;
  const raiz = seg.closest('[data-bloque="flujo"]');
  raiz.querySelectorAll('[data-vista-flujo] .segmento').forEach(function (b) {
    b.setAttribute('aria-checked', String(b === seg));
  });
  const barras = raiz.querySelector('[data-g="flujo"]');
  const sankey = raiz.querySelector('[data-g="sankey"]');
  if (!sankey) return;
  const mostrarSankey = seg.dataset.v === 'sankey';
  barras.hidden = mostrarSankey;
  sankey.hidden = !mostrarSankey;
}

function abrirDesglosePasivo(item, m) {
  UI.abrirHoja({
    titulo: item.nombre,
    html:
      '<div class="pila pila-2">' +
        (item.capital ? filaDetalle('Capital (no es costo)', item.capital, m) : '') +
        (item.interes ? filaDetalle('Interés', item.interes, m) : '') +
        (item.comisiones ? filaDetalle('Comisiones y seguros', item.comisiones, m) : '') +
        '<div class="fila-entre detalle-fila">' +
          '<span class="t-label" style="font-weight:600">Total</span>' +
          '<span class="t-label num" style="font-weight:600">' +
            UI.monto(item.total, m, { sinSigno: true }) + '</span></div>' +
      '</div>'
  });
}

function abrirDetalleHeatmap(g6, xi, yi, m) {
  const cat = g6.categorias[yi];
  const mes = g6.meses[xi];
  if (!cat) return;
  UI.abrirHoja({
    titulo: cat.nombre,
    html:
      '<p class="t-caption txt-2" style="margin-bottom:var(--sp-2)">' +
        UI.esc(nombrePeriodoLargo(mes)) + '</p>' +
      '<p class="t-display-l num">' + UI.monto(cat.valores[xi], m, { sinSigno: true }) + '</p>'
  });
}

function filaDetalle(etiqueta, valor, m) {
  return '<div class="fila-entre detalle-fila">' +
    '<span class="t-label txt-2">' + UI.esc(etiqueta) + '</span>' +
    '<span class="t-label num">' + UI.monto(valor, m, { sinSigno: true }) + '</span></div>';
}

function abrirDesgloseCascada(barra, desgloses, m) {
  const items = (desgloses && desgloses[barra.clave]) || [];
  UI.abrirHoja({
    titulo: barra.etiqueta,
    html:
      '<p class="t-display-l num" style="margin-bottom:var(--sp-4)">' +
        UI.monto(barra.valor, m, { sinSigno: true }) + '</p>' +
      (items.length
        ? '<div class="pila">' + items.map(function (x) {
            return '<div class="fila-entre detalle-fila">' +
              '<span class="t-label txt-2">' + UI.esc(x.nombre || x.concepto || '') + '</span>' +
              '<span class="t-label num">' + UI.monto(x.monto || x.valor || 0, m,
                { sinSigno: true }) + '</span></div>';
          }).join('') + '</div>'
        : '<p class="t-caption txt-3">Sin desglose disponible para este bloque.</p>')
  });
}

function abrirDetallePago(x, m) {
  if (!x) return;
  UI.abrirHoja({
    titulo: x.nombre,
    html:
      '<div class="pila pila-2">' +
        '<div class="fila-entre detalle-fila"><span class="t-label txt-2">Monto</span>' +
          '<span class="t-label num">' + UI.monto(x.monto, m, { sinSigno: true }) +
          '</span></div>' +
        '<div class="fila-entre detalle-fila"><span class="t-label txt-2">Fecha</span>' +
          '<span class="t-label">' + UI.esc(x.fecha) +
          (x.ajustada && x.motivo ? ' · ' + UI.esc(x.motivo) : '') + '</span></div>' +
        (x.detalle ? '<div class="fila-entre detalle-fila"><span class="t-label txt-2">Detalle' +
          '</span><span class="t-label">' + UI.esc(x.detalle) + '</span></div>' : '') +
      '</div>'
  });
}

function abrirTablaFlujos(g1, m) {
  if (!g1 || !g1.tabla_flujos.length) return;
  UI.abrirHoja({
    titulo: 'Tabla de flujos',
    html: '<div class="pila">' + g1.tabla_flujos.map(function (f) {
      return '<div class="fila-entre detalle-fila">' +
        '<span class="t-label txt-2 recorta">' + UI.esc(f.origen) + ' → ' +
          UI.esc(f.destino) + '</span>' +
        '<span class="t-label num">' + UI.monto(f.monto, m, { sinSigno: true }) + '</span>' +
      '</div>';
    }).join('') + '</div>'
  });
}

function abrirTodasCategorias(g2, m) {
  if (!g2) return;
  const hoja = UI.abrirHoja({
    titulo: 'Gasto por categoría',
    html:
      '<div class="campo-caja" style="margin-bottom:var(--sp-3)">' +
        UI.ico('search', 'ico-16') +
        '<input class="campo-control" type="search" data-buscar autocomplete="off" ' +
          'placeholder="Buscar categoría">' +
      '</div>' +
      '<div class="pila" data-lista>' + g2.todas.map(filaCategoriaTotal).join('') + '</div>',
    alAbrir: function (raiz) {
      raiz.addEventListener('input', function (e) {
        if (!e.target.matches('[data-buscar]')) return;
        const q = e.target.value.trim().toLowerCase();
        raiz.querySelectorAll('[data-fila]').forEach(function (f) {
          f.hidden = !!q && f.dataset.nombre.indexOf(q) < 0;
        });
      });
    }
  });

  function filaCategoriaTotal(c) {
    return '<div class="fila-entre detalle-fila" data-fila data-nombre="' +
      UI.esc(c.nombre.toLowerCase()) + '">' +
      '<span class="fila" style="gap:var(--sp-2)">' +
        '<span class="ico-cat ico-cat-sm" style="--color-cat:' + UI.esc(c.color) + '">' +
          UI.ico(c.icono) + '</span>' +
        '<span class="t-label recorta">' + UI.esc(c.nombre) + '</span>' +
      '</span>' +
      '<span class="fila" style="gap:var(--sp-2);flex:0 0 auto">' +
        (c.variacion ? '<span class="t-caption ' +
          (c.variacion.buena_noticia ? 'pos' : 'neg') + '">' +
          (c.variacion.direccion === 'BAJA' ? '↓' : '↑') +
          Math.abs(c.variacion.porcentaje * 100).toFixed(0) + '%</span>' : '') +
        '<span class="t-label num">' + UI.monto(c.monto, m, { sinSigno: true }) + '</span>' +
      '</span>' +
    '</div>';
  }
}

/** §10.2: stagger de 50ms entre bloques. */
function escalonar(vista) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  vista.querySelectorAll('.seccion-dash').forEach(function (s, i) {
    s.style.animationDelay = Math.min(i * 50, 250) + 'ms';
    s.classList.add('entra');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTADOS
// ═══════════════════════════════════════════════════════════════════════════════

function esqueleto() {
  return new Array(4).fill(
    '<section class="tarjeta seccion-dash pila pila-3">' +
      '<div class="hueso hueso-linea" style="width:40%"></div>' +
      '<div class="grafico"><div class="grafico-hueso"></div></div>' +
    '</section>').join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// FECHAS Y PERIODOS
// ═══════════════════════════════════════════════════════════════════════════════

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct',
                       'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                       'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function nombreMesCorto(periodo) {
  const p = String(periodo).split('-');
  return MESES_CORTOS[Number(p[1]) - 1] || String(periodo);
}

function nombrePeriodoLargo(periodo) {
  const p = String(periodo).split('-');
  const mes = MESES_LARGOS[Number(p[1]) - 1];
  return mes ? mes + ' ' + p[0] : String(periodo);
}

function periodoMas(periodo, delta) {
  const p = String(periodo).split('-').map(Number);
  const d = new Date(p[0], p[1] - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function periodoMenos(periodo, n) { return periodoMas(periodo, -n); }

function esMesFuturo(periodo) {
  const hoy = new Date();
  const tope = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  return periodo > tope;
}

function mesesEntre(desde, hasta) {
  const out = [];
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
  while (cursor <= hasta) {
    out.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

function isoDeFecha(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

})();
