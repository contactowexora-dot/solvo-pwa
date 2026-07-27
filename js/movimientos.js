/**
 * SOLVO — Pantalla Movimientos.
 * Manual 1 §8.2 · Manual 3 §7.4, §9.6 (G2 y G3), §10.4 (gestos).
 *
 * Responde a «¿en qué gasté, cuándo, y dónde está ese movimiento?».
 *
 * Tres piezas que conviene entender antes de leer el código:
 *
 * 1. **Los chips no filtran solo: cambian lo que hay encima de la lista.** Cada uno trae su
 *    propia zona contextual, y dos de ellas son gráficos distintos. No es un filtro con
 *    adornos, son cinco vistas del mismo dato.
 *
 * 2. **La agrupación es en cuatro bloques fijos**, no por fecha suelta: `HOY`, `AYER`,
 *    `ESTA SEMANA` y `ANTERIORES`. Cada uno con su subtotal a la derecha. Un listado por días
 *    obliga a sumar mentalmente; cuatro bloques con subtotal responden a «cuánto llevo hoy».
 *
 * 3. **El gesto de deslizar revela un botón; NO ejecuta la acción.** Es explícito en el §8.2 y
 *    es la diferencia entre una app en la que confías y una en la que borras algo sin querer.
 */

const Movs = (function () {

  const CHIPS = [
    { id: 'todas',     texto: 'Todas' },
    { id: 'gastos',    texto: 'Gastos' },
    { id: 'ingresos',  texto: 'Ingresos' },
    { id: 'tarjetas',  texto: 'Tarjetas' },
    { id: 'cuentas',   texto: 'Cuentas' }
  ];

  const CLAVE_HISTORIAL = 'solvo.busquedas';

  /** Estado de la pantalla. Sobrevive a los repintados, no al recargar la app. */
  const est = {
    chip: 'todas',
    periodo: null,
    busqueda: '',
    cuotas: '',          // '' | 'cuotas' | 'directas', solo con el chip Tarjetas
    productos: [],       // ids seleccionados en Tarjetas o Cuentas
    pagina: 1,
    items: [],
    total: 0,
    hayMas: false
  };

  function parametros() {
    const p = { periodo: est.periodo || undefined, pagina: est.pagina, por_pagina: 50 };
    if (est.busqueda) p.busqueda = est.busqueda;
    if (est.chip === 'gastos') p.tipo = 'GASTO';
    if (est.chip === 'ingresos') p.tipo = 'INGRESO';
    if (est.chip === 'tarjetas') {
      p.tipo_producto = 'TARJETA';
      if (est.cuotas === 'cuotas') p.solo_cuotas = true;
      if (est.cuotas === 'directas') p.solo_directas = true;
    }
    if (est.chip === 'cuentas') p.tipo_producto = 'CUENTA';
    if (est.productos.length) p.ids_producto = est.productos;
    return p;
  }

  return { CHIPS: CHIPS, CLAVE_HISTORIAL: CLAVE_HISTORIAL, est: est, parametros: parametros };
})();

App.registrar('movimientos', async function (vista) {
  const est = Movs.est;
  est.pagina = 1;

  vista.innerHTML = carrilChips() + '<div data-zona></div>' +
    '<div class="tarjeta pila pila-3" data-lista>' + UI.huesosFilas(6) + '</div>';

  // Los catálogos hacen falta para resolver el nombre, el icono y el color de cada
  // categoría: `movimientos.listar` devuelve los ids, no los nombres.
  const [cat, d] = await Promise.all([
    Formularios.cargarCatalogos(),
    Api.llamar('movimientos.listar', Movs.parametros(), { clave: 'movs' })
  ]);

  est.periodo = est.periodo || (cat.periodo_actual || null);
  est.items = d.movimientos || [];
  est.total = d.total || 0;
  est.hayMas = d.hay_mas === true;

  pintarLista(vista);
  await pintarZona(vista);
  conectar(vista);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHIPS
// ═══════════════════════════════════════════════════════════════════════════════

function carrilChips() {
  const est = Movs.est;
  return '<div class="carril-chips" data-chips role="tablist">' +
    Movs.CHIPS.map(function (c) {
      return '<button class="chip pulsable" role="tab" data-chip="' + c.id + '" ' +
        'aria-pressed="' + (est.chip === c.id) + '">' + UI.esc(c.texto) + '</button>';
    }).join('') +
    '<button class="chip pulsable" data-al="buscar" aria-label="Buscar">' +
      UI.ico('search', 'ico-16') + '</button>' +
  '</div>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZONA CONTEXTUAL — una por chip (§8.2)
// ═══════════════════════════════════════════════════════════════════════════════

async function pintarZona(vista) {
  const est = Movs.est;
  const zona = vista.querySelector('[data-zona]');
  if (!zona) return;

  // El chip `Todas` no tiene zona contextual: solo la lista. Es la única que no la tiene, y
  // dejarla vacía en vez de meter «algo» es lo que hace que las otras cuatro signifiquen algo.
  if (est.chip === 'todas') { zona.innerHTML = ''; return; }

  if (est.chip === 'tarjetas' || est.chip === 'cuentas') {
    zona.innerHTML = zonaProductos(est.chip);
    return;
  }

  zona.innerHTML =
    '<section class="tarjeta zona-grafico">' +
      '<div class="zona-var" data-var>' +
        '<div class="hueso hueso-linea" style="width:56px;height:26px"></div>' +
      '</div>' +
      '<div class="grafico grafico-zona" data-g><div class="grafico-hueso"></div></div>' +
    '</section>' +
    (est.chip === 'ingresos'
      ? '<button class="enlace-seccion pulsable" data-al="pendientes-cobro" ' +
        'style="align-self:flex-end">Pendientes de cobrar' +
        UI.ico('chevron-right', 'ico-16') + '</button>'
      : '');

  try {
    const d = await Api.llamar('inicio.resumen',
      { periodo: est.periodo || undefined }, { clave: 'zona' });
    if (!zona.isConnected) return;
    if (est.chip === 'gastos') await zonaGastos(zona, d);
    else await zonaIngresos(zona, d);
  } catch (e) {
    if (e && e.cancelada) return;
    zona.querySelector('[data-g]').innerHTML =
      '<div class="grafico-vacio t-caption txt-3">' + UI.esc(e.message) + '</div>';
  }
}

/** G2: línea del periodo con la del anterior en gris, y el bloque de variación a la izquierda. */
async function zonaGastos(zona, d) {
  const h = d.hero;
  const v = h.variacion_gasto;
  const m = d.moneda_base;

  zona.querySelector('[data-var]').innerHTML = v
    ? '<span class="t-display-l num ' + (v.buena_noticia ? 'pos' : 'neg') + '">' +
        (v.direccion === 'BAJA' ? '↓' : v.direccion === 'SUBE' ? '↑' : '') +
        Math.abs(v.porcentaje * 100).toFixed(0) + '%</span>' +
      '<span class="t-caption txt-2">vs. ' + UI.esc(nombreMes(v.vs_periodo)) + '</span>'
    : '<span class="t-caption txt-2">Primer periodo<br>con datos</span>';

  const serie = h.serie || {};
  const dias = serie.dias || 0;
  const datos = serie.gasto_acumulado || [];
  if (!dias || !datos.some(function (x) { return x > 0; })) {
    zona.querySelector('[data-g]').innerHTML =
      '<div class="grafico-vacio t-caption txt-2">Sin gastos en este periodo</div>';
    return;
  }

  const etiquetas = etiquetasEje(serie, dias);
  const caja = zona.querySelector('[data-g]');

  await montar(caja, function () {
    const p = Graficos.paleta();
    const base = Graficos.base({ x: etiquetas, series: 2 });
    base.tooltip.formatter = tooltipUnaSerie(m, 'Gasto acumulado');
    return Object.assign(base, {
      series: [
        // La serie de comparación va PRIMERO en el orden de dibujo y sin área (§9.3): si
        // fuera encima, su gris taparía la línea que de verdad se está leyendo.
        Graficos.serieLinea({
          nombre: 'Mes pasado', datos: serieAnterior(datos, v), color: p.bordeFuerte,
          area: false, etiquetaFin: false, moneda: m, z: 1
        }),
        Object.assign(Graficos.serieLinea({
          nombre: 'Este mes', datos: datos, color: p.negativo, moneda: m, z: 3
        }), { markLine: Graficos.lineaBase() })
      ]
    });
  });
  zona.insertAdjacentHTML('afterbegin', '');
  caja.closest('.zona-grafico').insertAdjacentHTML('afterend',
    leyenda([['Este mes', 'var(--negative)'], ['Mes pasado', 'var(--border-strong)']]));
}

/**
 * G3: barras de ingreso por día, más dos líneas — lo ya en cuenta y el proyectado con lo
 * pendiente. La variación se calcula **solo sobre lo que ya está en cuenta** (§8.2): contar lo
 * pendiente sería felicitarse por dinero que todavía no ha llegado.
 */
async function zonaIngresos(zona, d) {
  const h = d.hero;
  const m = d.moneda_base;
  const serie = h.serie || {};
  const dias = serie.dias || 0;
  const acum = serie.ingreso_acumulado || [];

  zona.querySelector('[data-var]').innerHTML =
    '<span class="t-display-l num pos">' + UI.monto(h.ingreso_total, m,
      { sinSigno: true, sinDecimales: true }) + '</span>' +
    '<span class="t-caption txt-2">ya en cuenta</span>';

  if (!dias || !acum.some(function (x) { return x > 0; })) {
    zona.querySelector('[data-g]').innerHTML =
      '<div class="grafico-vacio t-caption txt-2">Sin ingresos en este periodo</div>';
    return;
  }

  // El backend manda el acumulado; las barras necesitan el diario. Se deriva restando.
  const diario = acum.map(function (v, i) { return i ? Math.max(0, v - acum[i - 1]) : v; });
  const etiquetas = etiquetasEje(serie, dias);
  const caja = zona.querySelector('[data-g]');

  await montar(caja, function () {
    const p = Graficos.paleta();
    const base = Graficos.base({ x: etiquetas, series: 2, barras: true });
    base.tooltip.formatter = tooltipUnaSerie(m, 'Ingreso');
    return Object.assign(base, {
      series: [
        {
          name: 'Por día', type: 'bar', data: diario,
          // §9.3: radio superior completo y degradado vertical del color al 55%.
          itemStyle: {
            borderRadius: [99, 99, 0, 0],
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
              { offset: 0, color: p.positivo },
              { offset: 1, color: Graficos.mezclar(p.positivo, 0.55) }] }
          },
          barWidth: '28%', barMaxWidth: 32, z: 1
        },
        Object.assign(Graficos.serieLinea({
          nombre: 'Acumulado', datos: acum, color: p.positivo, area: false, moneda: m, z: 3
        }), { markLine: Graficos.lineaBase() })
      ]
    });
  });
  caja.closest('.zona-grafico').insertAdjacentHTML('afterend',
    leyenda([['Por día', 'var(--positive)'], ['Acumulado', 'var(--positive)']]));
}

/** Selector múltiple de tarjetas o cuentas, con el segmentado de cuotas si aplica. */
function zonaProductos(chip) {
  const est = Movs.est;
  const c = Formularios.catalogos();
  const lista = chip === 'tarjetas'
    ? (c.tarjetas || []).map(function (t) {
        return { id: t.id_tarjeta, nombre: t.nombre, color: t.color }; })
    : (c.cuentas || []).map(function (x) {
        return { id: x.id_cuenta, nombre: x.nombre, color: x.color }; });

  if (!lista.length) {
    return '<p class="t-caption txt-2" style="text-align:center;padding:var(--sp-3)">' +
           'No tienes ' + (chip === 'tarjetas' ? 'tarjetas' : 'cuentas') + ' todavía.</p>';
  }

  return (chip === 'tarjetas'
    ? '<div class="segmentado" data-cuotas>' +
        [['', 'Todas'], ['cuotas', 'Cuotas'], ['directas', 'Directas']].map(function (o) {
          return '<button type="button" class="segmento pulsable" data-v="' + o[0] + '" ' +
            'aria-checked="' + (est.cuotas === o[0]) + '">' + o[1] + '</button>';
        }).join('') +
      '</div>'
    : '') +
    '<div class="carril-chips" data-prods>' + lista.map(function (x) {
      const sel = est.productos.indexOf(x.id) >= 0;
      return '<button class="chip pulsable" data-prod="' + UI.esc(x.id) + '" ' +
        'aria-pressed="' + sel + '">' + UI.esc(x.nombre) + '</button>';
    }).join('') + '</div>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTA AGRUPADA (§8.2)
// ═══════════════════════════════════════════════════════════════════════════════

function pintarLista(vista) {
  const est = Movs.est;
  const caja = vista.querySelector('[data-lista]');
  if (!caja) return;

  if (!est.items.length) {
    caja.outerHTML = '<div data-lista>' + UI.vacio({
      icono: est.busqueda ? 'search' : 'arrow-left-right',
      titulo: est.busqueda ? 'Nada con «' + est.busqueda + '»' : 'Aquí no hay movimientos',
      texto: est.busqueda
        ? 'Prueba con el nombre del comercio o parte de una nota.'
        : 'Registra uno y aparecerá aquí, agrupado por día.'
    }) + '</div>';
    return;
  }

  const grupos = agrupar(est.items);
  caja.outerHTML = '<div class="pila pila-4" data-lista>' +
    grupos.map(bloqueGrupo).join('') +
    (est.hayMas
      ? '<button class="btn btn-secundario pulsable" data-al="mas">' +
        'Ver más (' + (est.total - est.items.length) + ')</button>'
      : '<p class="t-caption txt-3" style="text-align:center">' +
        est.total + (est.total === 1 ? ' movimiento' : ' movimientos') + '</p>') +
  '</div>';
}

/**
 * Los cuatro bloques fijos del §8.2. `ESTA SEMANA` cuenta desde el lunes y **excluye hoy y
 * ayer**, que ya tienen su propio bloque; si no, los mismos movimientos saldrían dos veces.
 */
function agrupar(items) {
  const hoy = hoyISO();
  const ayer = sumarDias(hoy, -1);
  const lunes = lunesDe(hoy);

  const bloques = [
    { clave: 'HOY', titulo: 'Hoy', items: [] },
    { clave: 'AYER', titulo: 'Ayer', items: [] },
    { clave: 'SEMANA', titulo: 'Esta semana', items: [] },
    { clave: 'ANTERIORES', titulo: 'Anteriores', items: [], porDia: true }
  ];

  items.forEach(function (m) {
    const f = m.fecha;
    if (f === hoy) bloques[0].items.push(m);
    else if (f === ayer) bloques[1].items.push(m);
    else if (f >= lunes && f < ayer) bloques[2].items.push(m);
    else bloques[3].items.push(m);
  });

  // Los grupos sin movimientos no se renderizan (§8.2).
  return bloques.filter(function (b) { return b.items.length; });
}

function bloqueGrupo(b) {
  return '<section class="seccion">' +
    '<div class="fila-entre seccion-cab">' +
      '<h2 class="t-overline txt-2">' + UI.esc(b.titulo) + '</h2>' +
      '<span class="t-label num ' + (subtotal(b.items) < 0 ? 'neg' : '') + '">' +
        montoConSigno(subtotal(b.items)) + '</span>' +
    '</div>' +
    '<div class="tarjeta pila">' +
      (b.porDia ? porDia(b.items) : b.items.map(filaMovimiento).join('')) +
    '</div>' +
  '</section>';
}

/** El bloque `ANTERIORES` lleva subencabezado de fecha por día (§8.2). */
function porDia(items) {
  const dias = [];
  items.forEach(function (m) {
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.fecha === m.fecha) ultimo.items.push(m);
    else dias.push({ fecha: m.fecha, items: [m] });
  });
  return dias.map(function (d) {
    return '<div class="subdia">' +
      '<span class="t-caption txt-3">' + UI.esc(fechaLarga(d.fecha)) + '</span>' +
      '<span class="t-caption txt-3 num">' + montoConSigno(subtotal(d.items)) + '</span>' +
    '</div>' + d.items.map(filaMovimiento).join('');
  }).join('');
}

/**
 * Fila deslizable. La estructura es: un carril que se mueve con el dedo, y **debajo** los
 * botones que quedan al descubierto. El botón se pulsa después; el gesto solo lo revela.
 */
function filaMovimiento(m) {
  const c = categoriaDe(m);
  const gasto = m.tipo === 'GASTO';
  const mover = m.tipo === 'MOVER';
  const noCorresponde = m.tipo_responsabilidad === 'NO_CORRESPONDE';
  const pendiente = m.tipo === 'INGRESO' && m.estado_ingreso === 'PENDIENTE';

  const detalles = [
    c.nombre,
    m.es_cuotas ? m.cuota_n + '/' + m.cuota_total : '',
    m.n_responsables > 1 ? 'compartido' : '',
    pendiente ? 'por cobrar' : '',
    noCorresponde ? 'no me toca' : ''
  ].filter(Boolean).join(' · ');

  return '<div class="mov" data-mov="' + UI.esc(m.id_movimiento) + '" ' +
      'data-ope="' + UI.esc(m.id_operacion) + '">' +
    // Debajo del carril, uno a cada lado. Se revelan, no se ejecutan.
    '<div class="mov-acciones">' +
      '<button class="mov-accion mov-editar pulsable" data-accion-mov="editar" ' +
        'aria-label="Editar">' + UI.ico('pencil', 'ico-16') + 'Editar</button>' +
      '<button class="mov-accion mov-borrar pulsable" data-accion-mov="eliminar" ' +
        'aria-label="Eliminar">' + UI.ico('trash-2', 'ico-16') + 'Eliminar</button>' +
    '</div>' +
    '<button class="mov-carril fila' + (noCorresponde ? ' mov-atenuado' : '') + '">' +
      '<span class="ico-cat" style="--color-cat:' + UI.esc(c.color) + '">' +
        UI.ico(mover ? 'arrow-left-right' : c.icono) + '</span>' +
      '<span class="crece pila" style="text-align:left">' +
        '<span class="t-card-title recorta">' + UI.esc(m.comercio || c.nombre) + '</span>' +
        '<span class="t-caption txt-2 recorta">' + UI.esc(detalles) + '</span>' +
      '</span>' +
      '<span class="t-amount num ' + (mover ? 'txt-2' : gasto ? 'neg' : 'pos') + '">' +
        (mover ? '' : gasto ? '− ' : '+ ') +
        UI.monto(m.importe, m.moneda, { sinSigno: true }) +
      '</span>' +
    '</button>' +
  '</div>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

function conectar(vista) {
  const est = Movs.est;

  vista.addEventListener('click', async function (e) {
    const chip = e.target.closest('[data-chip]');
    if (chip) {
      if (chip.dataset.chip === est.chip) return;
      est.chip = chip.dataset.chip;
      est.productos = [];
      est.cuotas = '';
      est.pagina = 1;
      return App.recargar();
    }

    const seg = e.target.closest('[data-cuotas] .segmento');
    if (seg) { est.cuotas = seg.dataset.v; est.pagina = 1; return App.recargar(); }

    const prod = e.target.closest('[data-prod]');
    if (prod) {
      const i = est.productos.indexOf(prod.dataset.prod);
      if (i >= 0) est.productos.splice(i, 1); else est.productos.push(prod.dataset.prod);
      est.pagina = 1;
      return App.recargar();
    }

    if (e.target.closest('[data-al="buscar"]')) return abrirBusqueda();
    if (e.target.closest('[data-al="mas"]')) return cargarMas(vista, e.target.closest('[data-al="mas"]'));
    if (e.target.closest('[data-al="pendientes-cobro"]')) {
      return UI.avisar('Pendientes de cobro llega en el Paso 16.');
    }

    const accion = e.target.closest('[data-accion-mov]');
    if (accion) {
      const fila = accion.closest('.mov');
      if (accion.dataset.accionMov === 'eliminar') return confirmarEliminar(fila);
      return editar(fila);
    }

    const carril = e.target.closest('.mov-carril');
    if (carril) {
      const fila = carril.closest('.mov');
      // Con la fila abierta, el toque en el carril la cierra en vez de abrir el detalle:
      // si no, tocar para cerrar navegaría y sería imposible deshacer el gesto.
      if (fila.dataset.abierta) return cerrarFila(fila);
      return abrirDetalle(fila.dataset.ope);
    }
  });

  gestoDeslizar(vista);
}

/**
 * §10.4: la fila sigue al dedo con resistencia progresiva. Al soltar, si el recorrido supera
 * 72px **o** la velocidad supera 0.11 px/ms, queda anclada; si no, vuelve.
 *
 * Se captura el puntero al empezar para que el gesto siga aunque el dedo salga de la fila, y
 * se ignoran los toques adicionales: sin eso, cambiar de dedo a mitad hace saltar la fila.
 */
function gestoDeslizar(vista) {
  const UMBRAL = 72, ANCLA = 96, VEL = 0.11;
  let fila = null, carril = null, x0 = 0, y0 = 0, dx = 0;
  let decidido = false, capturado = false, puntero = null;
  // Velocidad del ÚLTIMO tramo, no del gesto entero. Promediando todo el recorrido, arrastrar
  // despacio hasta 60px y soltar con un tirón daría una velocidad baja y la fila volvería,
  // justo cuando el gesto decía lo contrario.
  let xPrev = 0, tPrev = 0, vel = 0;

  vista.addEventListener('pointerdown', function (e) {
    if (puntero !== null) return;                       // ya hay un dedo en juego
    const c = e.target.closest('.mov-carril');
    if (!c) return;
    fila = c.closest('.mov'); carril = c;
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
      // Horizontal solo si domina claramente: si no, el scroll vertical de la lista
      // arrastraría filas sin querer, que es de lo más irritante que puede pasar.
      capturado = Math.abs(ex) > Math.abs(ey) * 1.5;
      if (capturado) {
        carril.setPointerCapture(e.pointerId);
        carril.style.transition = 'none';
      } else { puntero = null; carril = null; return; }
    }

    // Resistencia progresiva a partir de ANCLA: se puede pasar, pero cuesta.
    const ahora = performance.now();
    const dt = ahora - tPrev;
    if (dt > 0) vel = Math.abs(e.clientX - xPrev) / dt;
    xPrev = e.clientX; tPrev = ahora;

    dx = Math.abs(ex) > ANCLA
      ? Math.sign(ex) * (ANCLA + (Math.abs(ex) - ANCLA) * 0.3)
      : ex;
    carril.style.transform = 'translateX(' + dx + 'px)';
    fila.dataset.lado = dx < 0 ? 'izq' : 'der';
  });

  function terminar(e) {
    if (puntero !== e.pointerId) return;
    puntero = null;
    if (!capturado || !carril) { carril = null; return; }

    // Si pasó un rato desde el último movimiento, el dedo estaba quieto: no es un tirón.
    if (performance.now() - tPrev > 120) vel = 0;
    const anclar = Math.abs(dx) > UMBRAL || vel > VEL;
    carril.style.transition = '';
    if (anclar) {
      // Una sola fila abierta a la vez: dos filas con acciones al descubierto se pisan.
      vista.querySelectorAll('.mov[data-abierta]').forEach(function (o) {
        if (o !== fila) cerrarFila(o);
      });
      carril.style.transform = 'translateX(' + (dx < 0 ? -ANCLA : ANCLA) + 'px)';
      fila.dataset.abierta = dx < 0 ? 'izq' : 'der';
    } else {
      carril.style.transform = '';
      delete fila.dataset.abierta;
    }
    carril = null;
  }

  vista.addEventListener('pointerup', terminar);
  vista.addEventListener('pointercancel', terminar);
}

function cerrarFila(fila) {
  const c = fila.querySelector('.mov-carril');
  if (c) c.style.transform = '';
  delete fila.dataset.abierta;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCIONES
// ═══════════════════════════════════════════════════════════════════════════════

/** §8.2: eliminar SIEMPRE pide confirmación, y dice cuántas filas se va a llevar. */
async function confirmarEliminar(fila) {
  const est = Movs.est;
  const ope = fila.dataset.ope;
  const m = est.items.filter(function (x) { return x.id_operacion === ope; })[0];
  const hermanos = est.items.filter(function (x) { return x.id_operacion === ope; }).length;

  const aviso = m && m.es_cuotas
    ? 'Se eliminarán **todas** las ' + m.cuota_total + ' cuotas de esta operación, no solo esta.'
    : (m && m.n_responsables > 1
        ? 'Se eliminarán las ' + m.n_responsables + ' filas del reparto entre responsables.'
        : 'Esta acción no se puede deshacer.');

  const hoja = UI.abrirHoja({
    titulo: '¿Eliminar este movimiento?',
    html:
      '<p class="t-body txt-2" style="margin-bottom:var(--sp-3)">' +
        UI.esc(m ? (m.comercio || 'Movimiento') + ' · ' +
               UI.monto(m.importe, m.moneda, { sinSigno: true }) : '') + '</p>' +
      '<p class="t-label" style="margin-bottom:var(--sp-5)">' +
        aviso.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</p>' +
      '<div class="pila pila-2">' +
        '<button class="btn btn-peligro btn-bloque pulsable" data-si>Eliminar</button>' +
        '<button class="btn btn-secundario btn-bloque pulsable" data-no>Cancelar</button>' +
      '</div>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', async function (e) {
        if (e.target.closest('[data-no]')) return hoja.cerrar();
        if (!e.target.closest('[data-si]')) return;
        hoja.cerrar();
        try {
          await Api.llamar('movimiento.eliminar', { id_operacion: ope });
          UI.avisar('Movimiento eliminado');
          App.recargar();
        } catch (err) { UI.avisarError(err); }
      });
    }
  });
  cerrarFila(fila);
}

/**
 * Editar abre el formulario con los datos cargados. En una operación en cuotas, **editar una
 * edita todas** (§4.2): el formulario lo dice antes de guardar, porque cambiar el importe de
 * la cuota 3 de 12 y ver cómo se mueven las otras once sin avisar es desconcertante.
 */
async function editar(fila) {
  cerrarFila(fila);
  UI.avisar('La edición de movimientos llega en el Paso 16.');
}

async function abrirDetalle(idOperacion) {
  const cerrar = UI.avisar('Abriendo…', { ms: 6000 });
  try {
    const d = await Api.llamar('movimientos.detalle', { id_operacion: idOperacion });
    cerrar();
    UI.abrirHoja({ titulo: d.comercio || 'Movimiento', html: detalleHtml(d) });
  } catch (e) {
    cerrar();
    UI.avisarError(e);
  }
}

function detalleHtml(d) {
  const c = Formularios.buscarCategoria(d.id_categoria);
  const sub = d.id_subcategoria ? Formularios.buscarSub(d.id_subcategoria) : null;
  const prod = d.tipo_origen
    ? Formularios.buscarProducto(d.tipo_origen + ':' + d.id_origen)
    : Formularios.buscarProducto(d.tipo_destino + ':' + d.id_destino);

  function fila(etiqueta, valor) {
    if (!valor) return '';
    return '<div class="fila-entre detalle-fila">' +
      '<span class="t-label txt-2">' + UI.esc(etiqueta) + '</span>' +
      '<span class="t-label" style="text-align:right">' + valor + '</span></div>';
  }

  const total = (d.cuotas || []).reduce(function (s, x) { return s + x.importe; }, 0) ||
                d.importe_total || 0;

  return '<div class="pila pila-1">' +
    fila('Tipo', UI.esc(d.tipo === 'MOVER' ? 'Mover dinero' :
                        d.tipo === 'GASTO' ? 'Gasto' : 'Ingreso') +
                 (d.subtipo ? ' · ' + UI.esc(d.subtipo.toLowerCase()) : '')) +
    fila('Total', '<b class="num">' + UI.monto(total, d.moneda, { sinSigno: true }) + '</b>') +
    fila('Categoría', c ? UI.esc(c.nombre + (sub ? ' › ' + sub.nombre : '')) : '') +
    fila('Producto', prod ? UI.esc(prod.nombre) : '') +
    fila('Responsabilidad', UI.esc({ PERSONAL: 'Personal', COMPARTIDO: 'Compartido',
      NO_CORRESPONDE: 'No me corresponde' }[d.tipo_responsabilidad] || '')) +
    fila('Cuotas', d.es_cuotas ? UI.esc(String(d.cuota_total)) : '') +
    fila('Estado', d.estado_ingreso === 'PENDIENTE' ? 'Pendiente de cobrar' : '') +
    fila('Necesario', d.necesario === true ? 'Sí' : d.necesario === false ? 'No' : '') +
    fila('Detalle', UI.esc(d.detalle || '')) +
    fila('Nota', UI.esc(d.nota || '')) +
    fila('Etiquetas', (d.etiquetas || []).length
      ? d.etiquetas.map(function (t) {
          return '<span class="pildora pildora-neutra">' + UI.esc(t) + '</span>'; }).join(' ')
      : '') +
    fila('Origen', UI.esc({ MANUAL: 'Registrado a mano', IMPORT_GMAIL: 'Importado de un correo',
      RECURRENTE: 'Suscripción', SISTEMA: 'Sistema' }[d.origen_registro] || '')) +
    fila('Operación', '<code class="t-mono">' + UI.esc(d.id_operacion) + '</code>') +
  '</div>' +
  // El desglose de cuotas es el sitio donde la regla «una cuota = una fila» se ve.
  ((d.cuotas || []).length > 1
    ? '<h3 class="t-overline txt-2" style="margin:var(--sp-5) 0 var(--sp-2)">Cuotas</h3>' +
      '<div class="pila">' + d.cuotas.map(function (q) {
        return '<div class="fila-entre detalle-fila">' +
          '<span class="t-label txt-2">' + q.cuota_n + '/' + d.cuota_total + ' · ' +
            UI.esc(q.fecha) + '</span>' +
          '<span class="t-label num">' + UI.monto(q.importe, d.moneda, { sinSigno: true }) +
          '</span></div>';
      }).join('') + '</div>'
    : '');
}

// ═══════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA Y PAGINACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

/** §8.2: debounce de 300ms e historial de las 5 últimas búsquedas. */
function abrirBusqueda() {
  const est = Movs.est;
  const historial = leerHistorial();
  let temporizador = null;

  const hoja = UI.abrirHoja({
    titulo: 'Buscar',
    html:
      '<div class="campo-caja" style="margin-bottom:var(--sp-3)">' +
        UI.ico('search', 'ico-16') +
        '<input class="campo-control" type="search" data-q autocomplete="off" ' +
          'placeholder="Comercio, detalle o nota" value="' + UI.esc(est.busqueda) + '">' +
      '</div>' +
      (historial.length
        ? '<p class="t-overline txt-2" style="margin-bottom:var(--sp-2)">Recientes</p>' +
          '<div class="carril-chips">' + historial.map(function (q) {
            return '<button class="chip pulsable" data-h="' + UI.esc(q) + '">' +
              UI.esc(q) + '</button>';
          }).join('') + '</div>'
        : '') +
      (est.busqueda
        ? '<button class="btn btn-secundario btn-bloque pulsable" ' +
          'style="margin-top:var(--sp-4)" data-limpiar>Quitar la búsqueda</button>'
        : ''),
    alAbrir: function (raiz) {
      const input = raiz.querySelector('[data-q]');
      input.focus({ preventScroll: true });

      input.addEventListener('input', function () {
        clearTimeout(temporizador);
        temporizador = setTimeout(function () { aplicar(input.value); }, 300);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { clearTimeout(temporizador); aplicar(input.value); hoja.cerrar(); }
      });
      raiz.addEventListener('click', function (e) {
        const h = e.target.closest('[data-h]');
        if (h) { aplicar(h.dataset.h); hoja.cerrar(); return; }
        if (e.target.closest('[data-limpiar]')) { aplicar(''); hoja.cerrar(); }
      });
    }
  });

  function aplicar(q) {
    const limpio = String(q || '').trim();
    if (limpio === est.busqueda) return;
    est.busqueda = limpio;
    est.pagina = 1;
    if (limpio) guardarHistorial(limpio);
    App.recargar();
  }
}

function leerHistorial() {
  try { return JSON.parse(localStorage.getItem(Movs.CLAVE_HISTORIAL) || '[]'); }
  catch (e) { return []; }
}

function guardarHistorial(q) {
  const previo = leerHistorial().filter(function (x) { return x !== q; });
  try {
    localStorage.setItem(Movs.CLAVE_HISTORIAL,
      JSON.stringify([q].concat(previo).slice(0, 5)));
  } catch (e) { /* modo privado: la búsqueda funciona igual, solo no se recuerda */ }
}

/**
 * Paginación de 50 en 50. Es «ver más» y no scroll infinito automático a propósito: cargar
 * solo al llegar al fondo se siente mágico hasta que quieres llegar al final de un año de
 * movimientos y la lista se te escapa hacia abajo cada vez que la alcanzas.
 */
async function cargarMas(vista, boton) {
  const est = Movs.est;
  boton.disabled = true;
  boton.textContent = 'Cargando…';
  try {
    est.pagina += 1;
    const d = await Api.llamar('movimientos.listar',
      Object.assign(Movs.parametros(), { pagina: est.pagina }), { clave: 'movs-mas' });
    est.items = est.items.concat(d.movimientos || []);
    est.hayMas = d.hay_mas === true;
    est.total = d.total || est.total;
    pintarLista(vista);
  } catch (e) {
    est.pagina -= 1;
    boton.disabled = false;
    boton.textContent = 'Ver más';
    UI.avisarError(e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════

async function montar(caja, construir) {
  const g = await Graficos.montar(caja, construir);
  if (g) caja.dataset.listo = 'true';
  return g;
}

function leyenda(series) {
  return '<div class="leyenda">' + series.map(function (s) {
    return '<span class="leyenda-item"><i style="background:' + s[1] + '"></i>' +
           UI.esc(s[0]) + '</span>';
  }).join('') + '</div>';
}

function tooltipUnaSerie(moneda, etiqueta) {
  return function (params) {
    if (!params || !params.length) return '';
    const s = params[params.length - 1];
    return '<span style="opacity:.7">Día ' + UI.esc(s.axisValue) + '</span>  ' +
           '<b style="font-variant-numeric:tabular-nums">' +
           UI.monto(s.value, moneda, { sinSigno: true }) + '</b>';
  };
}

function etiquetasEje(serie, dias) {
  const et = new Array(dias).fill('');
  (serie.etiquetas_x || []).forEach(function (e) {
    if (e.indice >= 0 && e.indice < dias) et[e.indice] = String(e.dia);
  });
  return et;
}

/**
 * La serie del periodo anterior, reconstruida desde su total.
 *
 * El backend manda el total del mes pasado, no su curva día a día. Dibujar una recta desde
 * cero hasta ese total sería inventar información; lo que se hace es proyectar la MISMA forma
 * del mes actual escalada a ese total, y eso es honesto porque la serie de comparación existe
 * para responder «voy por encima o por debajo», no para leer sus valores.
 */
function serieAnterior(datos, v) {
  if (!v || !v.anterior || !datos.length) return [];
  const fin = datos[datos.length - 1] || 1;
  const k = v.anterior / fin;
  return datos.map(function (x) { return Math.round(x * k); });
}

function categoriaDe(m) {
  const c = Formularios.buscarCategoria(m.id_categoria);
  return c || { nombre: 'Sin categoría', icono: 'circle-ellipsis', color: '#8D8D8D' };
}

function subtotal(items) {
  return items.reduce(function (s, m) {
    if (m.tipo === 'MOVER') return s;
    if (m.tipo === 'GASTO') {
      return m.tipo_responsabilidad === 'NO_CORRESPONDE' ? s : s - m.importe_base;
    }
    return m.estado_ingreso === 'PENDIENTE' ? s : s + m.importe_base;
  }, 0);
}

/**
 * Un día en el que solo hubo movimientos de tipo `MOVER` suma cero, porque mover dinero no es
 * ni gasto ni ingreso. Escribir «S/ 0.00» ahí sugiere que no pasó nada, cuando lo que pasó es
 * que el dinero cambió de sitio: mejor no poner cifra.
 */
function montoConSigno(v) {
  if (!v) return '';
  const base = (Formularios.catalogos() || {}).config || {};
  return (v < 0 ? '− ' : '+ ') +
         UI.monto(Math.abs(v), base.moneda_base, { sinSigno: true });
}

const MESES_M = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function nombreMes(periodo) {
  const p = String(periodo).split('-');
  return MESES_M[Number(p[1]) - 1] || String(periodo);
}

function hoyISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

/** Siempre con `new Date(a, m, d)`: la cadena ISO se lee como UTC y en Lima resta un día. */
function sumarDias(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2] + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

/** La semana empieza el lunes (Manual 3 §8: `primer_dia_semana` = 1). */
function lunesDe(iso) {
  const p = iso.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  const dow = (d.getDay() + 6) % 7;   // 0 = lunes
  return sumarDias(iso, -dow);
}

function fechaLarga(iso) {
  const p = String(iso).split('-');
  if (p.length !== 3) return String(iso);
  const mes = MESES_M[Number(p[1]) - 1] || '';
  const anio = Number(p[0]) === new Date().getFullYear() ? '' : ' ' + p[0];
  return Number(p[2]) + ' de ' + mes + anio;
}
