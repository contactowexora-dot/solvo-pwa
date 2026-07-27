/**
 * SOLVO — Sistema de gráficos.
 * Manual 3 §9 completo. ECharts 6 compilada a medida en `vendor/echarts.min.js`.
 *
 * ══ LA REGLA MAESTRA (§9.2) ══════════════════════════════════════════════════════
 *
 *   Ningún gráfico de línea ni de barras muestra el eje Y. Sin marcas, sin etiquetas,
 *   sin rejilla. El área empieza en el borde izquierdo de la tarjeta.
 *
 * No es preferencia estética: obliga a que **el valor viva en otro sitio**, y esa es la
 * decisión de producto. El número protagonista va en la cabecera de la tarjeta, en grande,
 * antes del gráfico. El gráfico muestra **forma**, no magnitud.
 *
 * Consecuencia práctica que conviene tener presente al escribir cualquier pantalla: la
 * tarjeta tiene que ser útil aunque el gráfico no llegue a dibujarse. Y por eso ECharts se
 * carga en diferido: son 251 KB en tránsito, y hacer esperar la cifra del mes a que baje una
 * librería de gráficos sería exactamente al revés de lo que dice el §9.2.
 */
const Graficos = (function () {

  const RUTA = 'vendor/echarts.min.js';
  let promesaCarga = null;
  const vivos = new Set();

  // ═══════════════════════════════════════════════════════════════════════════
  // CARGA DIFERIDA
  // ═══════════════════════════════════════════════════════════════════════════

  function cargar() {
    if (window.echarts) return Promise.resolve(window.echarts);
    if (promesaCarga) return promesaCarga;

    promesaCarga = new Promise(function (resolver, rechazar) {
      const s = document.createElement('script');
      s.src = RUTA;
      s.async = true;
      s.onload = function () {
        window.echarts ? resolver(window.echarts)
                       : rechazar(new Error('echarts.min.js cargó pero no expone `echarts`.'));
      };
      s.onerror = function () {
        // Sin red y sin copia en caché. Las cifras ya están pintadas, así que la tarjeta
        // sigue sirviendo: solo se queda sin su dibujo.
        rechazar(new Error('No pude cargar los gráficos.'));
      };
      document.head.appendChild(s);
    }).catch(function (e) {
      promesaCarga = null;   // que un fallo puntual no deje la app sin gráficos para siempre
      throw e;
    });

    return promesaCarga;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMA — leído de los tokens, nunca escrito a mano (§12)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Los colores salen de las variables CSS en cada render. Así el gráfico sigue al tema sin
   * duplicar la paleta aquí: un hex escrito en este archivo sería el primer sitio donde el
   * tema oscuro se rompería sin que nadie lo notara.
   */
  function css(nombre) {
    return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  }

  function paleta() {
    return {
      ink: css('--ink'), onInk: css('--on-ink'),
      borde: css('--border'), bordeFuerte: css('--border-strong'),
      texto3: css('--text-tertiary'), texto2: css('--text-secondary'),
      superficie: css('--bg-surface'),
      positivo: css('--positive'), negativo: css('--negative'),
      acento: css('--accent')
    };
  }

  function reducido() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN BASE (§9.8)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * De aquí parte TODO gráfico de línea o barra. Los cuatro `show: false` del eje Y y el
   * `splitLine: false` son el punto de la lista de entrega del §12 que se verifica gráfico
   * por gráfico.
   */
  function baseLineaBarra(op) {
    const p = paleta();
    op = op || {};
    return {
      animation: !reducido(),
      animationDuration: 420,
      animationDelay: function (i) { return i * 30; },
      animationEasing: 'cubicOut',
      // §9.7: 0 a la izquierda —el gráfico llega al borde interior de la tarjeta— y 12 a la
      // derecha para que la etiqueta de fin de serie no se corte.
      grid: { left: 0, right: op.derecha === undefined ? 12 : op.derecha,
              top: 8, bottom: 24, containLabel: false },
      xAxis: {
        type: 'category',
        boundaryGap: op.barras === true,
        data: op.x || [],
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: p.texto3, fontSize: 11, fontWeight: 600,
          fontFamily: 'Inter', letterSpacing: 0.9, hideOverlap: true,
          formatter: function (v) { return String(v).toUpperCase(); }
        }
      },
      yAxis: {
        type: 'value',
        show: false,            // ← LA REGLA (§9.2)
        axisLabel: { show: false },
        axisLine:  { show: false },
        axisTick:  { show: false },
        splitLine: { show: false },
        // Un poco de aire arriba para que la etiqueta de fin de serie no toque el borde.
        max: function (v) { return v.max * 1.12 || 1; },
        min: 0
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: p.ink,
        borderWidth: 0,
        padding: [8, 12],
        // El radio del §9.3: píldora con un valor, --r-md con varios.
        extraCssText: 'border-radius:' + ((op.series || 1) > 1 ? '16px' : '999px') +
                      ';box-shadow:0 8px 24px rgba(0,0,0,.18)',
        textStyle: { color: p.onInk, fontSize: 12, fontFamily: 'Inter' },
        axisPointer: {
          type: 'line',
          lineStyle: { color: p.bordeFuerte, type: [3, 3], width: 1 }
        },
        // En móvil el tooltip se activa al tocar y permanece hasta tocar fuera (§9.7).
        triggerOn: 'mousemove|click',
        confine: true
      }
    };
  }

  /** La línea de base discontinua en el cero, que sustituye al eje (§9.3). */
  function lineaBase() {
    return {
      silent: true, symbol: 'none', animation: false,
      data: [{ yAxis: 0 }],
      label: { show: false },
      lineStyle: { color: paleta().borde, type: [2, 4], width: 1 }
    };
  }

  /** Degradado vertical del color al 18% hasta 0% (§9.3). Solo el periodo actual. */
  function areaDegradada(color) {
    return {
      color: {
        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: mezclar(color, 0.18) },
          { offset: 1, color: mezclar(color, 0) }
        ]
      }
    };
  }

  /** Un color de token a rgba con la opacidad pedida. Acepta #rgb, #rrggbb y rgb(). */
  function mezclar(color, alfa) {
    const c = String(color).trim();
    let r, g, b;
    if (c[0] === '#') {
      const h = c.length === 4
        ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3]
        : c.slice(1, 7);
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    } else {
      const m = c.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      if (!m) return c;
      r = +m[1]; g = +m[2]; b = +m[3];
    }
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alfa + ')';
  }

  /** La etiqueta de fin de serie (§9.3, §9.8): el único número permanente dentro del área. */
  function etiquetaFin(color, moneda) {
    return {
      show: true, distance: 6, offset: [0, -2],
      color: color, fontSize: 12, fontWeight: 600, fontFamily: 'Inter',
      formatter: function (p) {
        return UI.monto(p.value, moneda, { sinSigno: true, sinDecimales: true });
      }
    };
  }

  /** Serie de línea con el lenguaje visual del §9.3. */
  function serieLinea(op) {
    return {
      name: op.nombre,
      type: 'line',
      data: op.datos,
      smooth: 0.35,
      symbol: 'circle',
      symbolSize: 0,
      showSymbol: false,
      lineStyle: { width: 2.5, cap: 'round', color: op.color },
      itemStyle: { color: op.color, borderWidth: 2.5, borderColor: paleta().superficie },
      emphasis: { scale: false, focus: 'series',
                  itemStyle: { color: op.color, borderWidth: 2.5,
                               borderColor: paleta().superficie } },
      // El punto activo es un círculo de 8px con borde del fondo de la tarjeta (§9.3).
      selectedMode: false,
      areaStyle: op.area === false ? undefined : areaDegradada(op.color),
      endLabel: op.etiquetaFin === false ? { show: false }
                                         : etiquetaFin(op.color, op.moneda),
      z: op.z || 2
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MONTAJE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Crea el gráfico dentro de `el`, ya dimensionado por CSS.
   *
   * Devuelve un objeto con `actualizar` y `destruir`. Quien monta un gráfico es responsable
   * de destruirlo: ECharts retiene el canvas y sus escuchas, y en una app de una sola página
   * que repinta al navegar eso son fugas que se acumulan hasta que el móvil va a tirones.
   */
  async function montar(el, opciones) {
    const echarts = await cargar();
    // La pantalla pudo cambiar mientras bajaba la librería.
    if (!el.isConnected) return null;

    // `opciones` puede ser una FUNCIÓN. Es lo que permite rehacer el gráfico al cambiar de
    // tema sin volver a pedir los datos: los colores se leen de los tokens en cada llamada,
    // así que basta con invocarla otra vez. Con un objeto plano, el gráfico se quedaría con
    // la paleta del momento en que se montó y el §12 pide que el tema cambie sin recargar.
    const construir = typeof opciones === 'function' ? opciones : function () { return opciones; };

    const inst = echarts.init(el, null, { renderer: 'canvas' });
    inst.setOption(construir());

    // §B.2 regla 6: ECharts se re-renderiza en resize con debounce de 150ms.
    let t = null;
    const alRedimensionar = function () {
      clearTimeout(t);
      t = setTimeout(function () { if (el.isConnected) inst.resize(); }, 150);
    };
    // ResizeObserver y no `resize` de ventana: la tarjeta cambia de ancho cuando se abre una
    // hoja, cuando aparece el aviso de sin conexión o cuando cambia el margen seguro, y
    // ninguno de esos casos dispara `resize`.
    const ro = 'ResizeObserver' in window ? new ResizeObserver(alRedimensionar) : null;
    if (ro) ro.observe(el); else addEventListener('resize', alRedimensionar);

    const api = {
      inst: inst,
      actualizar: function (op) { if (el.isConnected) inst.setOption(op, { notMerge: false }); },
      // Rehace el gráfico con la paleta actual. `notMerge` es obligatorio: sin él, ECharts
      // fusiona y los colores viejos sobreviven en las propiedades que no se reescriben.
      retematizar: function () {
        if (!el.isConnected) return;
        inst.setOption(construir(), { notMerge: true });
      },
      destruir: function () {
        clearTimeout(t);
        if (ro) ro.disconnect(); else removeEventListener('resize', alRedimensionar);
        inst.dispose();
        vivos.delete(api);
      }
    };
    vivos.add(api);
    return api;
  }

  /** Destruye todos los gráficos vivos. Lo llama el router antes de repintar. */
  function destruirTodos() {
    Array.from(vivos).forEach(function (g) {
      try { g.destruir(); } catch (e) { /* ya estaba desmontado */ }
    });
    vivos.clear();
  }

  /** Lo llama el cambio de tema. Sin esto el gráfico se queda con la paleta anterior. */
  function retematizarTodos() {
    vivos.forEach(function (g) {
      try { g.retematizar(); } catch (e) { /* instancia ya desechada */ }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // G1 · HERO DE INICIO — línea doble gasto vs. ingreso (§9.6)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Dos series acumuladas día a día, ambas con área. Sin eje Y: las dos cifras van en la
   * cabecera de la tarjeta, una a cada lado. Al tocar, línea guía vertical y tooltip con
   * ambos valores.
   */
  function opcionesG1(serie, moneda) {
    const p = paleta();
    const base = baseLineaBarra({ x: serie.etiquetas_x || [], series: 2 });

    base.tooltip.formatter = function (params) {
      if (!params || !params.length) return '';
      const dia = params[0].axisValue;
      const filas = params.map(function (s) {
        return '<div style="display:flex;gap:10px;align-items:center;' +
               'justify-content:space-between">' +
                 '<span style="display:flex;gap:6px;align-items:center">' +
                   '<i style="width:8px;height:8px;border-radius:9px;background:' +
                     s.color + ';display:inline-block"></i>' + s.seriesName +
                 '</span>' +
                 '<b style="font-variant-numeric:tabular-nums">' +
                   UI.monto(s.value, moneda, { sinSigno: true }) + '</b>' +
               '</div>';
      }).join('');
      return '<div style="font-weight:600;margin-bottom:4px;opacity:.7">Día ' +
             UI.esc(dia) + '</div>' + filas;
    };

    return Object.assign(base, {
      series: [
        // El gasto va primero para que su área quede por debajo: es la serie que más
        // interesa leer, y superponerle la de ingresos la ensuciaría.
        Object.assign(serieLinea({
          nombre: 'Gasto', datos: serie.gasto_acumulado || [],
          color: p.negativo, moneda: moneda, z: 3
        }), { markLine: lineaBase() }),
        serieLinea({
          nombre: 'Ingreso', datos: serie.ingreso_acumulado || [],
          color: p.positivo, moneda: moneda, z: 2
        })
      ]
    });
  }

  return {
    cargar: cargar,
    montar: montar,
    destruirTodos: destruirTodos,
    retematizarTodos: retematizarTodos,
    opcionesG1: opcionesG1,
    // Piezas reutilizables por los gráficos de los pasos siguientes.
    base: baseLineaBarra,
    serieLinea: serieLinea,
    lineaBase: lineaBase,
    areaDegradada: areaDegradada,
    etiquetaFin: etiquetaFin,
    paleta: paleta,
    mezclar: mezclar,
    _css: css
  };
})();
