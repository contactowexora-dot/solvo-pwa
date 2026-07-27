/**
 * SOLVO — Pantalla Productos (versión mínima).
 * Manual 1 §8.5 · Manual 5 §C (fechas de tarjeta).
 *
 * Solo cuentas y tarjetas: es lo que hace falta para poder registrar un movimiento. Préstamos,
 * inversiones, edición, archivado y el hero de patrimonio llegan en el Paso 14.
 *
 * Se adelanta porque sin un producto el formulario de gasto no tiene dónde poner nada, y
 * mandar a alguien a crear filas a mano en el Sheet es justo lo que la app existe para evitar.
 */
App.registrar('productos', async function (vista) {
  vista.innerHTML = '<div class="tarjeta pila pila-3">' + UI.huesosFilas(3) + '</div>';

  const d = await Api.llamar('productos.listar', {}, { clave: 'productos' });
  const m = d.moneda_base;

  // `productos.listar` devuelve cada grupo como `{ total, items }`, no como un array, y solo
  // incluye la clave si el grupo tiene algo. Yo leía `d.cuentas.length` sobre el objeto
  // envolvente: siempre daba `undefined`, así que la pantalla se quedaba para siempre en su
  // estado vacío aunque la cuenta existiera. Lo confirmaba el hecho de que **sí** aparecía en
  // los selectores del formulario, que salen de `catalogos` y no de aquí.
  const cuentas = (d.cuentas && d.cuentas.items) || [];
  const tarjetas = (d.tarjetas && d.tarjetas.items) || [];
  const totalCuentas = (d.cuentas && d.cuentas.total) || 0;

  if (!cuentas.length && !tarjetas.length) {
    vista.innerHTML = UI.vacio({
      icono: 'wallet',
      titulo: 'Empieza por tus cuentas',
      texto: 'Añade la cuenta por la que te entra el sueldo y la tarjeta con la que gastas. ' +
             'Sin eso no hay dónde registrar un movimiento.',
      cta: { texto: 'Añadir una cuenta', accion: 'cuenta' }
    });
    // También la tarjeta desde el estado vacío: quien empieza por la tarjeta no tiene por
    // qué crear una cuenta primero para encontrar el botón.
    vista.querySelector('.vacio').insertAdjacentHTML('beforeend',
      '<button class="btn btn-secundario pulsable" data-accion="tarjeta">' +
      UI.ico('credit-card', 'ico-16') + 'O una tarjeta</button>');
  } else {
    vista.innerHTML =
      (cuentas.length ? bloqueCuentas(cuentas, totalCuentas, m) : '') +
      (tarjetas.length ? bloqueTarjetas(tarjetas, m) : '') +
      '<div class="fila" style="gap:var(--sp-3)">' +
        '<button class="btn btn-secundario crece pulsable" data-nuevo="cuenta">' +
          UI.ico('plus', 'ico-16') + 'Cuenta</button>' +
        '<button class="btn btn-secundario crece pulsable" data-nuevo="tarjeta">' +
          UI.ico('plus', 'ico-16') + 'Tarjeta</button>' +
      '</div>';
  }

  vista.addEventListener('click', async function (e) {
    const b = e.target.closest('[data-nuevo], [data-accion]');
    if (!b) return;
    try {
      await App.abrirFormulario(b.dataset.nuevo || b.dataset.accion);
    } catch (err) { UI.avisarError(err); }
  });
});

function bloqueCuentas(cuentas, total, m) {
  return '<section class="seccion">' +
    '<div class="fila-entre seccion-cab">' +
      '<h2 class="t-card-title">Cuentas</h2>' +
      '<span class="t-label num txt-2">' + UI.monto(total, m, { sinSigno: true }) + '</span>' +
    '</div>' +
    '<div class="tarjeta pila">' + cuentas.map(function (c) {
      return '<div class="fila fila-producto">' +
        '<span class="ico-cat" style="--color-cat:' + UI.esc(c.color || '#8D8D8D') + '">' +
          UI.ico(c.icono) + '</span>' +
        '<span class="crece pila">' +
          '<span class="t-card-title recorta">' + UI.esc(c.nombre) + '</span>' +
          '<span class="t-caption txt-2 recorta">' +
            UI.esc([c.banco, c.moneda, c.numero_final && '•••' + c.numero_final]
                   .filter(Boolean).join(' · ')) + '</span>' +
        '</span>' +
        // §3.3: el signo va PEGADO al número, no solo el color. Un saldo en descubierto
        // mostrado como «S/ 120.00» en rojo se lee como 120 a favor si no distingues el tono
        // —y en una app de dinero eso no es un detalle estético.
        '<span class="t-amount num ' + (c.saldo < 0 ? 'neg' : '') + '">' +
          (c.saldo < 0 ? '− ' : '') +
          UI.monto(c.saldo, c.moneda, { sinSigno: true }) + '</span>' +
      '</div>';
    }).join('') + '</div>' +
  '</section>';
}

function bloqueTarjetas(tarjetas, m) {
  return '<section class="seccion">' +
    '<div class="fila-entre seccion-cab"><h2 class="t-card-title">Tarjetas</h2></div>' +
    tarjetas.map(function (t) {
      const pct = Math.min(100, Math.max(0, (Number(t.utilizacion) || 0) * 100));
      const color = { OK: 'var(--positive)', AVISO: 'var(--warning)',
                      ALTO: 'var(--warning)', CRITICO: 'var(--negative)' }
                    [t.nivel_utilizacion] || 'var(--accent)';
      return '<div class="tarjeta pila pila-3">' +
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
        // §C.2: si la fecha se movió por día no hábil, se dice por qué. Una fecha que
        // aparece cambiada sin explicación parece un error del sistema.
        (t.proximo_pago
          ? '<div class="fila-entre" style="border-top:1px solid var(--border);' +
              'padding-top:var(--sp-3)">' +
              '<span class="t-caption txt-2">Cierra ' + UI.esc(t.proximo_cierre || '—') +
                (t.cierre_ajustado ? ' *' : '') + '</span>' +
              '<span class="t-caption txt-2">Paga ' + UI.esc(t.proximo_pago) +
                (t.pago_ajustado ? ' *' : '') + '</span>' +
            '</div>' +
            (t.cierre_ajustado || t.pago_ajustado
              ? '<span class="t-caption txt-3">* ' +
                UI.esc(t.motivo_pago || t.motivo_cierre) + '</span>'
              : '')
          : '') +
      '</div>';
    }).join('') +
  '</section>';
}
