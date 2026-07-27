/**
 * SOLVO — Pantalla Inicio.
 * Manual 1 §8.1 · Manual 3 §7 (componentes), §9.6 G1 (hero), §10 (movimiento).
 *
 * Responde a una pregunta: «¿cómo van mis finanzas este mes y hay algo que requiera mi
 * atención?». Cinco secciones en orden de jerarquía, y **cuatro de ellas son condicionales**:
 * si no hay insights, la sección no existe; si no hay pendientes, tampoco. Una pantalla que
 * enseña cuatro bloques vacíos con «no hay nada» es peor que una pantalla corta.
 *
 * La cifra se pinta antes que el gráfico, siempre. ECharts son 251 KB y la regla del §9.2
 * dice que el valor vive en la cabecera, no en el eje: la tarjeta ya sirve sin su dibujo.
 */

/** Periodo mostrado. Vive fuera del render porque sobrevive a los repintados. */
let _periodoInicio = null;

App.registrar('inicio', async function (vista) {
  vista.innerHTML = esqueleto();

  const d = await Api.llamar('inicio.resumen',
    _periodoInicio ? { periodo: _periodoInicio } : {}, { clave: 'inicio' });
  _periodoInicio = d.periodo;

  // Antes del `return` del estado vacío: si no, al pasar a un periodo sin acciones la
  // campana se queda con el número del anterior y pide atención sobre algo que ya no existe.
  App.marcarAcciones(d.acciones_pendientes);

  if (d.sin_datos) { pintarVacio(vista); return; }

  const m = d.moneda_base;
  vista.innerHTML =
    heroCard(d, m) +
    seccionInsights(d.insights) +
    seccionPendientes(d.pendientes_registro, m) +
    seccionPagos(d.proximos_pagos, m) +
    seccionRecientes(d.movimientos_recientes, m);

  conectar(vista, d, m);
  escalonar(vista);
});

// ═══════════════════════════════════════════════════════════════════════════════
// HERO (§8.1 · G1)
// ═══════════════════════════════════════════════════════════════════════════════

function heroCard(d, m) {
  const h = d.hero;
  return '<section class="tarjeta hero" data-hero>' +
    // Las dos cifras, una a cada lado, como manda G1. Ambas son pulsables (§8.1).
    '<div class="hero-cifras">' +
      cifraHero('Gastos', h.gasto_total, m, 'neg', 'presupuesto') +
      cifraHero('Ingresos', h.ingreso_total, m, 'pos', 'ingresos') +
    '</div>' +
    (h.variacion_gasto ? '<div class="hero-var">' + pildoraVariacion(h.variacion_gasto) +
      '<span class="t-caption txt-2">vs. ' + UI.esc(nombrePeriodo(h.variacion_gasto.vs_periodo)) +
      '</span></div>' : '') +

    // El marco del gráfico se mantiene siempre, tenga datos o no (§9.7): si desapareciera,
    // el layout saltaría al cambiar de periodo.
    '<div class="grafico" data-g1><div class="grafico-hueso"></div></div>' +
    leyenda([['Gasto', 'var(--negative)'], ['Ingreso', 'var(--positive)']]) +

    (h.presupuesto && h.presupuesto.configurado
      ? barraPresupuesto(h.presupuesto, m)
      : '<button class="hero-cta pulsable" data-al="presupuesto">' +
        'Configurar presupuesto' + UI.ico('chevron-right', 'ico-16') + '</button>') +
  '</section>';
}

/**
 * Las dos cifras del hero van **sin decimales**, como el mock del §8.1 (`S/ 12,450`).
 *
 * No es solo fidelidad al manual: son dos cifras compartiendo el ancho, y a 320px «S/
 * 16,250.00» a 24px no cabe en media columna y se parte en dos líneas. Los céntimos de un
 * total mensual no le dicen nada a nadie; el valor exacto está en el tooltip del gráfico y
 * en la lista de movimientos.
 */
function cifraHero(etiqueta, valor, m, clase, destino) {
  return '<button class="hero-cifra pulsable" data-al="' + destino + '">' +
    '<span class="t-overline txt-2">' + UI.esc(etiqueta) + '</span>' +
    '<span class="cifra-hero num ' + clase + '" data-cifra="' + destino + '" ' +
      'title="' + UI.esc(UI.monto(valor, m, { sinSigno: true })) + '">' +
      UI.monto(valor, m, { sinSigno: true, sinDecimales: true }) + '</span>' +
  '</button>';
}

/** §7.5: el color lo decide `buena_noticia` del servidor, no el signo. */
function pildoraVariacion(v) {
  const pct = Math.abs(Number(v.porcentaje) * 100);
  const clase = v.buena_noticia === null ? 'pildora-neutra'
              : (v.buena_noticia ? 'pildora-pos' : 'pildora-neg');
  const flecha = v.direccion === 'IGUAL' ? ''
               : UI.ico(v.direccion === 'SUBE' ? 'arrow-up-right' : 'arrow-down-left');
  return '<span class="pildora ' + clase + '">' + flecha +
         pct.toFixed(pct < 10 ? 1 : 0).replace('.0', '') + '%</span>';
}

/** §9.3: obligatoria cuando hay dos series. */
function leyenda(series) {
  return '<div class="leyenda">' + series.map(function (s) {
    return '<span class="leyenda-item"><i style="background:' + s[1] + '"></i>' +
           UI.esc(s[0]) + '</span>';
  }).join('') + '</div>';
}

function barraPresupuesto(p, m) {
  const pct = Math.min(100, Math.max(0, Number(p.porcentaje) * 100));
  const color = { OK: 'var(--positive)', AVISO: 'var(--warning)', EXCEDIDO: 'var(--negative)' }
                [p.nivel] || 'var(--accent)';
  return '<button class="presupuesto pulsable" data-al="presupuesto">' +
    '<div class="fila-entre">' +
      '<span class="t-label">Presupuesto del periodo</span>' +
      '<span class="t-label num txt-2">' + Math.round(pct) + '%</span>' +
    '</div>' +
    '<div class="pista-progreso">' +
      '<div class="relleno-progreso" style="width:' + pct.toFixed(1) + '%;background:' +
        color + '"></div>' +
    '</div>' +
    '<span class="t-caption txt-2 num">' + UI.monto(p.gastado, m, { sinSigno: true }) +
      ' de ' + UI.monto(p.total, m, { sinSigno: true }) + '</span>' +
  '</button>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIONES CONDICIONALES
// ═══════════════════════════════════════════════════════════════════════════════

function cabeceraSeccion(titulo, extra) {
  return '<div class="fila-entre seccion-cab">' +
    '<h2 class="t-card-title">' + UI.esc(titulo) + '</h2>' +
    (extra || '') + '</div>';
}

/** Máximo 3, carrusel. Si no hay insights, la sección completa desaparece (§8.1). */
function seccionInsights(insights) {
  if (!insights || !insights.length) return '';
  return '<section class="seccion">' +
    cabeceraSeccion('Insights',
      '<button class="enlace-seccion pulsable" data-al="insights">Ver más' +
      UI.ico('chevron-right', 'ico-16') + '</button>') +
    '<div class="carril">' + insights.slice(0, 3).map(function (i) {
      return '<article class="tarjeta tarjeta-carril pulsable" data-insight="' +
        UI.esc(i.id_insight) + '">' +
        '<span class="ico-cat" style="--color-cat:var(--cat-indigo)">' +
          UI.ico(i.icono || 'sparkles') + '</span>' +
        (i.cifra !== '' && i.cifra != null
          ? '<span class="t-title num">' + UI.esc(formatoCifra(i.cifra, i.unidad)) + '</span>'
          : '') +
        '<span class="t-label recorta-2">' + UI.esc(i.titulo) + '</span>' +
      '</article>';
    }).join('') + '</div>' +
  '</section>';
}

/** El backend manda la cifra ya tipada: número si es numérica, texto si no. */
function formatoCifra(cifra, unidad) {
  if (typeof cifra === 'number') {
    if (unidad === '%') return (cifra * 100).toFixed(0) + '%';
    if (unidad && unidad !== 'PEN' && unidad !== 'USD' && unidad !== 'EUR') {
      return cifra.toLocaleString('es-PE') + ' ' + unidad;
    }
    return UI.monto(cifra, unidad, { sinSigno: true, sinDecimales: Math.abs(cifra) >= 1000 });
  }
  return String(cifra);
}

/** Tarjetas del importador. Tap → modal de registro pre-llenado (llega en el Paso 12). */
function seccionPendientes(p, m) {
  if (!p || !p.items || !p.items.length) return '';
  return '<section class="seccion">' +
    cabeceraSeccion('Pendientes de registro',
      '<span class="pildora pildora-neutra">' + p.total + '</span>') +
    '<div class="carril">' + p.items.map(function (x) {
      return '<article class="tarjeta tarjeta-carril pulsable" data-pendiente="' +
        UI.esc(x.id_pendiente) + '">' +
        '<span class="t-label recorta">' + UI.esc(x.comercio) + '</span>' +
        '<span class="t-amount num neg">− ' +
          UI.monto(x.importe, x.moneda || m, { sinSigno: true }) + '</span>' +
        '<span class="t-caption txt-2">' + UI.esc(fechaCorta(x.fecha)) +
          (x.numero_final ? ' · •••' + UI.esc(x.numero_final) : '') + '</span>' +
      '</article>';
    }).join('') + '</div>' +
  '</section>';
}

/** Solo lo que vence en ≤7 días o ya venció. Máximo 3, vencidos primero (§8.1). */
function seccionPagos(p, m) {
  if (!p || !p.items || !p.items.length) return '';
  const hoy = fechaHoyISO();
  return '<section class="seccion">' +
    cabeceraSeccion('Próximos pagos',
      p.hay_mas ? '<button class="enlace-seccion pulsable" data-al="pagos">Ver todos (' +
                  p.total_disponibles + ')' + UI.ico('chevron-right', 'ico-16') + '</button>'
                : '') +
    '<div class="tarjeta pila">' + p.items.map(function (x) {
      const dias = diasEntre(hoy, x.fecha);
      const vencido = dias < 0;
      return '<div class="fila fila-pago">' +
        '<span class="ico-cat" style="--color-cat:' + UI.esc(x.color || '#8D8D8D') + '">' +
          UI.ico(x.icono || 'calendar-clock') + '</span>' +
        '<span class="crece pila">' +
          '<span class="t-card-title recorta">' + UI.esc(x.nombre) + '</span>' +
          '<span class="t-caption ' + (vencido ? 'neg' : 'txt-2') + '">' +
            (vencido ? 'vencido' : dias === 0 ? 'vence hoy' :
             dias === 1 ? 'mañana' : 'en ' + dias + ' días') +
            (x.detalle ? ' · ' + UI.esc(x.detalle) : '') +
            // §C.2: si la fecha se movió por día no hábil, se dice por qué.
            (x.ajustada && x.motivo ? ' · ' + UI.esc(x.motivo) : '') +
          '</span>' +
        '</span>' +
        '<span class="t-amount num">' + UI.monto(x.monto, m, { sinSigno: true }) + '</span>' +
      '</div>';
    }).join('') + '</div>' +
  '</section>';
}

/** Últimos 5-7. Fila de movimiento del §7.4. */
function seccionRecientes(items, m) {
  if (!items || !items.length) return '';
  return '<section class="seccion">' +
    cabeceraSeccion('Movimientos recientes') +
    '<div class="tarjeta pila">' + items.slice(0, 7).map(function (x) {
      const gasto = x.tipo === 'GASTO';
      return '<button class="fila fila-mov pulsable" data-movimiento="' +
        UI.esc(x.id_movimiento) + '">' +
        '<span class="ico-cat" style="--color-cat:' + UI.esc(x.color) + '">' +
          UI.ico(x.icono) + '</span>' +
        '<span class="crece pila" style="text-align:left">' +
          '<span class="t-card-title recorta">' + UI.esc(x.comercio || x.categoria) + '</span>' +
          '<span class="t-caption txt-2 recorta">' +
            UI.esc([x.categoria, fechaRelativa(x.fecha),
                    x.cuota && 'cuota ' + x.cuota,
                    x.n_responsables > 1 && 'compartido'].filter(Boolean).join(' · ')) +
          '</span>' +
        '</span>' +
        // §3.3: el signo pegado al número y siempre presente. El color acompaña, no informa.
        '<span class="t-amount num ' + (gasto ? 'neg' : 'pos') + '">' +
          (gasto ? '− ' : '+ ') + UI.monto(x.importe, x.moneda, { sinSigno: true }) +
        '</span>' +
      '</button>';
    }).join('') +
    '<button class="ver-todos pulsable" data-al="movimientos">Ver todos' +
      UI.ico('chevron-right', 'ico-16') + '</button>' +
    '</div>' +
  '</section>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACCIÓN
// ═══════════════════════════════════════════════════════════════════════════════

function conectar(vista, d, m) {
  // El gráfico se monta después de pintar: la cifra ya está en pantalla y ECharts puede
  // tardar lo que necesite sin bloquear nada (§9.2).
  const caja = vista.querySelector('[data-g1]');
  if (caja) montarG1(caja, d.hero.serie, m);

  vista.addEventListener('click', function (e) {
    const dest = e.target.closest('[data-al]');
    if (dest) return irA(dest.dataset.al);

    const mov = e.target.closest('[data-movimiento]');
    if (mov) return UI.avisar('El detalle de movimiento llega en el Paso 11.');

    const pnd = e.target.closest('[data-pendiente]');
    if (pnd) return UI.avisar('El registro desde un correo llega en el Paso 12.');

    const ins = e.target.closest('[data-insight]');
    if (ins) return UI.avisar('La pantalla de Insights llega en el Paso 11.');
  });

  gestoPeriodo(vista.querySelector('[data-hero]'));
}

function irA(destino) {
  if (destino === 'movimientos' || destino === 'presupuesto') return App.ir(destino);
  if (destino === 'ingresos') return App.ir('movimientos');
  UI.avisar('Esa pantalla llega en un paso próximo.');
}

async function montarG1(caja, serie, m) {
  const dias = (serie && serie.dias) || 0;
  const hayDatos = dias > 0 &&
    (serie.gasto_acumulado || []).some(function (v) { return v > 0; });

  if (!hayDatos) {
    // §9.7: el marco se mantiene y se centra el texto. El gráfico no desaparece.
    caja.innerHTML = '<div class="grafico-vacio t-caption txt-2">' +
                     'Sin movimientos en este periodo</div>';
    return;
  }

  // El eje X lleva solo los días 1, 8, 15, 22 y el último (§9.6 G1). El backend manda las
  // posiciones; aquí se convierten en una fila de etiquetas del largo de la serie.
  const etiquetas = new Array(dias).fill('');
  (serie.etiquetas_x || []).forEach(function (e) {
    if (e.indice >= 0 && e.indice < dias) etiquetas[e.indice] = String(e.dia);
  });

  const datos = Object.assign({}, serie, { etiquetas_x: etiquetas });

  try {
    // Se pasa la FUNCIÓN, no el objeto: así el gráfico se puede rehacer con la paleta nueva
    // cuando cambia el tema, sin volver a pedir los datos al servidor.
    const g = await Graficos.montar(caja, function () {
      return Graficos.opcionesG1(datos, m);
    });
    if (g) caja.dataset.listo = 'true';
  } catch (err) {
    // Sin librería no hay dibujo, pero la tarjeta ya dio la cifra: es exactamente el caso
    // que el §9.2 previene al sacar el número del eje.
    caja.innerHTML = '<div class="grafico-vacio t-caption txt-3">' +
                     UI.esc(err.message) + '</div>';
  }
}

/**
 * §8.1: swipe horizontal cambia de periodo. Se exige que el gesto sea claramente horizontal
 * antes de capturarlo — si no, arrastrar para hacer scroll vertical sobre el hero cambiaría
 * de mes sin querer, que es de los errores más molestos que puede tener una app así.
 */
function gestoPeriodo(hero) {
  if (!hero || !App.plataforma) return;
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
    // Horizontal solo si domina claramente: 1.6 veces el desplazamiento vertical.
    capturado = Math.abs(dx) > Math.abs(dy) * 1.6;
    if (capturado) hero.setPointerCapture(e.pointerId);
  });

  hero.addEventListener('pointerup', function (e) {
    if (!capturado) return;
    capturado = false;
    const dx = e.clientX - x0;
    if (Math.abs(dx) < 56) return;
    cambiarPeriodo(dx < 0 ? 1 : -1);
  });

  hero.addEventListener('pointercancel', function () { capturado = false; });
}

function cambiarPeriodo(delta) {
  const p = String(_periodoInicio || '').split('-');
  if (p.length !== 2) return;
  const d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
  const nuevo = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

  // No se navega al futuro: no hay nada que enseñar y el usuario se pierde.
  const hoy = new Date();
  const tope = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  if (nuevo > tope) return;

  _periodoInicio = nuevo;
  App.recargar();
}

/** §10.2: stagger de 50ms entre ítems, translateY(8px) + fade. Nunca bloquea la interacción. */
function escalonar(vista) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const secciones = vista.querySelectorAll('.seccion');
  secciones.forEach(function (s, i) {
    s.style.animationDelay = Math.min(i * 50, 200) + 'ms';
    s.classList.add('entra');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ESTADOS
// ═══════════════════════════════════════════════════════════════════════════════

/** §8.1: skeletons con la forma exacta de cada card. Nunca spinners. */
function esqueleto() {
  return '<section class="tarjeta hero">' +
    '<div class="hero-cifras">' +
      '<div class="pila pila-2"><div class="hueso hueso-linea" style="width:52px;height:10px">' +
        '</div><div class="hueso" style="height:28px;width:120px;border-radius:12px"></div></div>' +
      '<div class="pila pila-2"><div class="hueso hueso-linea" style="width:60px;height:10px">' +
        '</div><div class="hueso" style="height:28px;width:110px;border-radius:12px"></div></div>' +
    '</div>' +
    '<div class="grafico"><div class="grafico-hueso"></div></div>' +
    '<div class="hueso" style="height:8px;border-radius:999px;margin-top:var(--sp-4)"></div>' +
  '</section>' +
  '<section class="seccion"><div class="tarjeta pila pila-3">' + UI.huesosFilas(4) +
  '</div></section>';
}

function pintarVacio(vista) {
  vista.innerHTML = UI.vacio({
    icono: 'sparkles',
    titulo: 'Empecemos por lo primero',
    texto: 'Registra tu primer movimiento y aquí verás en qué se te va el mes.',
    cta: { texto: 'Registrar un movimiento', accion: 'registrar' }
  });
  const b = vista.querySelector('[data-accion="registrar"]');
  if (b) b.addEventListener('click', function () { document.getElementById('fab').click(); });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FECHAS
// ═══════════════════════════════════════════════════════════════════════════════

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «2026-07» → «julio». El año solo si no es el actual: repetirlo es ruido. */
function nombrePeriodo(periodo) {
  const p = String(periodo).split('-');
  const mes = MESES[Number(p[1]) - 1];
  if (!mes) return String(periodo);
  return Number(p[0]) === new Date().getFullYear() ? mes : mes + ' ' + p[0];
}

function fechaHoyISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Días entre dos ISO, contados como fechas civiles. Se construyen con `new Date(a,m,d)` y no
 * con `new Date('2026-07-18')`: la cadena ISO se interpreta como UTC, y en Lima (−05:00) eso
 * devuelve el día anterior. Es el error clásico que hace que «hoy» salga como «ayer».
 */
function diasEntre(desdeISO, hastaISO) {
  const a = String(desdeISO).split('-').map(Number);
  const b = String(hastaISO).split('-').map(Number);
  if (a.length !== 3 || b.length !== 3) return 0;
  const d1 = new Date(a[0], a[1] - 1, a[2]);
  const d2 = new Date(b[0], b[1] - 1, b[2]);
  return Math.round((d2 - d1) / 86400000);
}

function fechaRelativa(iso) {
  const d = diasEntre(iso, fechaHoyISO());
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d > 1 && d < 7) return 'Hace ' + d + ' días';
  return fechaCorta(iso);
}

function fechaCorta(iso) {
  const p = String(iso).split('-');
  if (p.length !== 3) return String(iso);
  return Number(p[2]) + ' ' + (MESES[Number(p[1]) - 1] || '').slice(0, 3);
}
