/**
 * SOLVO — Mover dinero.
 * Manual 1 §7.6 · Manual 2 §4.2 · Manual 3 §11 (móvil: lista de 5 destinos a pantalla completa).
 *
 * ══ MOVER NO ES NI INGRESO NI GASTO ══════════════════════════════════════════════
 *
 * Pagar la tarjeta no es un gasto: el gasto fue el consumo, y contarlo otra vez al pagar lo
 * duplicaría. Aportar a un objetivo tampoco: el dinero sigue siendo tuyo, solo cambió de
 * sitio. Por eso `MOVER` es su propio tipo y no suma en ninguna de las dos columnas.
 *
 * **La única excepción** es la parte de INTERÉS de la cuota de un préstamo: ese dinero sí
 * sale de tu patrimonio y no vuelve. El servidor lo separa en su propia fila con
 * `tipo = GASTO`, `subtipo = INTERES`. Este formulario solo manda el pago; el desglose entre
 * capital e interés lo calcula el backend con el cronograma.
 */
function formularioMover(prellenado) {
  const pre = prellenado || {};

  // Paso 1: elegir destino. Cinco opciones a pantalla completa (§11).
  if (!pre.subtipo) return elegirDestino();

  return formularioDeMovimiento(pre.subtipo);
}

const DESTINOS_MOVER = [
  { subtipo: 'PAGO_TARJETA',    titulo: 'Pagar una tarjeta',   icono: 'credit-card',
    color: 'var(--cat-indigo)', desc: 'Reduce la deuda de la tarjeta' },
  { subtipo: 'PAGO_PRESTAMO',   titulo: 'Pagar un préstamo',   icono: 'landmark',
    color: 'var(--cat-violeta)', desc: 'Marca la cuota y separa el interés' },
  { subtipo: 'APORTE_OBJETIVO', titulo: 'Aportar a un objetivo', icono: 'target',
    color: 'var(--cat-teal)',   desc: 'Acerca la meta sin contarlo como gasto' },
  { subtipo: 'MOVER_INVERSION', titulo: 'Mover a una inversión', icono: 'trending-up',
    color: 'var(--cat-lima)',   desc: 'Sale de la cuenta, sigue siendo tuyo' },
  { subtipo: 'TRANSFERENCIA',   titulo: 'Transferir entre cuentas', icono: 'arrow-left-right',
    color: 'var(--cat-azul)',   desc: 'De una cuenta tuya a otra' }
];

function elegirDestino() {
  const api = Formularios.abrirCascaron({
    titulo: 'Mover dinero',
    guardar: 'Continuar',
    html:
      '<p class="t-body txt-2" style="margin-bottom:var(--sp-4)">' +
        'Mover dinero no es un gasto ni un ingreso: el dinero cambia de sitio, no ' +
        'desaparece.</p>' +
      '<ul class="pila pila-2">' + DESTINOS_MOVER.map(function (d) {
        return '<li><button type="button" class="fila pulsable fila-opcion" ' +
          'data-destino="' + d.subtipo + '">' +
          '<span class="ico-cat" style="--color-cat:' + d.color + '">' +
            UI.ico(d.icono) + '</span>' +
          '<span class="crece pila" style="text-align:left">' +
            '<span class="t-card-title">' + UI.esc(d.titulo) + '</span>' +
            '<span class="t-caption txt-2">' + UI.esc(d.desc) + '</span>' +
          '</span>' + UI.ico('chevron-right') +
        '</button></li>';
      }).join('') + '</ul>'
  });

  // El pie no aporta nada aquí: se elige tocando una opción, no confirmando abajo.
  api.el.querySelector('.formulario-pie').hidden = true;

  api.cuerpo.addEventListener('click', function (e) {
    const b = e.target.closest('[data-destino]');
    if (!b) return;
    api.cerrar(true);
    formularioDeMovimiento(b.dataset.destino);
  });
  return api;
}

function formularioDeMovimiento(subtipo) {
  const c = Formularios.catalogos();
  const def = DESTINOS_MOVER.filter(function (d) { return d.subtipo === subtipo; })[0];

  const idMonto = Campos.id();
  const idFecha = Campos.id();
  const idOrigen = Campos.id();
  const idDestino = Campos.id();
  const idDetalle = Campos.id();

  const est = { origen: '', destino: '' };
  const dest = destinosDisponibles(subtipo, c);

  const api = Formularios.abrirCascaron({
    titulo: def.titulo,
    guardar: 'Confirmar',
    html:
      Campos.monto({ id: idMonto, etiqueta: 'Monto', autofoco: true,
        simbolo: simboloDe(c.config.moneda_base) }) +

      Campos.fecha({ id: idFecha, etiqueta: 'Fecha',
        valor: Formularios.hoyISO(), max: Formularios.hoyISO() }) +

      Campos.selector({ id: idOrigen, etiqueta: 'Desde qué cuenta', abre: 'origen',
        vacio: 'Elegir cuenta' }) +

      Campos.selector({ id: idDestino, etiqueta: etiquetaDestino(subtipo), abre: 'destino',
        vacio: dest.length ? 'Elegir' : 'No hay ninguno todavía' }) +

      Campos.texto({ id: idDetalle, etiqueta: 'Detalle', opcional: true, max: 200 }) +

      (subtipo === 'PAGO_PRESTAMO'
        ? '<p class="nota-formulario t-caption">' + UI.ico('info', 'ico-16') +
          '<span>La parte de <b>interés</b> de la cuota se registra aparte como gasto. ' +
          'El capital solo cambia de sitio.</span></p>'
        : '') +
      (subtipo === 'PAGO_TARJETA'
        ? '<p class="nota-formulario t-caption">' + UI.ico('info', 'ico-16') +
          '<span>Pagar la tarjeta <b>no</b> es un gasto: el gasto fue el consumo. Esto ' +
          'reduce la deuda.</span></p>'
        : '')
  });

  const raiz = api.cuerpo;

  if (!dest.length) {
    raiz.querySelector('#' + idDestino).setAttribute('aria-disabled', 'true');
  }

  raiz.addEventListener('click', function (e) {
    const sel = e.target.closest('[data-abre]');
    if (!sel) return;

    if (sel.dataset.abre === 'origen') {
      Formularios.elegirProducto(true, est.origen, function (clave) {
        est.origen = clave;
        const p = Formularios.buscarProducto(clave);
        Campos.fijarSelector(sel, clave, p.nombre, p.icono, p.color);
        const simb = raiz.querySelector('[data-simbolo]');
        if (simb) simb.textContent = simboloDe(p.moneda || c.config.moneda_base);
        revisar();
      });
    }

    if (sel.dataset.abre === 'destino') {
      if (!dest.length) return UI.avisar('Primero crea uno en Productos.', { error: true });
      const hoja = UI.abrirHoja({
        titulo: etiquetaDestino(subtipo),
        html: '<ul class="pila">' + dest.map(function (d) {
          return '<li><button type="button" class="fila pulsable fila-opcion" ' +
            'data-d="' + UI.esc(d.id) + '">' +
            '<span class="ico-cat ico-cat-sm" style="--color-cat:' +
              UI.esc(d.color || '#8D8D8D') + '">' + UI.ico(d.icono) + '</span>' +
            '<span class="crece t-card-title recorta" style="text-align:left">' +
              UI.esc(d.nombre) + '</span></button></li>';
        }).join('') + '</ul>',
        alAbrir: function (r) {
          r.addEventListener('click', function (ev) {
            const b = ev.target.closest('[data-d]');
            if (!b) return;
            hoja.cerrar();
            est.destino = b.dataset.d;
            const d = dest.filter(function (x) { return x.id === b.dataset.d; })[0];
            Campos.fijarSelector(sel, d.id, d.nombre, d.icono, d.color);
            revisar();
          });
        }
      });
    }
  });

  Campos.validarCon(raiz, idMonto, function () {
    const v = Campos.valor(raiz, idMonto);
    if (v === null) return 'Falta el monto.';
    if (v <= 0) return 'El monto tiene que ser mayor que cero.';
    return '';
  });

  function completo() {
    const m = Campos.valor(raiz, idMonto);
    return m !== null && m > 0 && !!Campos.valor(raiz, idFecha) &&
           !!est.origen && !!est.destino;
  }
  function revisar() { api.botón.disabled = !completo(); api.ensuciar(); }

  Campos.conectar(raiz, revisar);
  revisar();

  api.guardar = function () {
    if (!completo()) return;
    const orig = Formularios.buscarProducto(est.origen);
    Formularios.enviar(api, 'mover.ejecutar', {
      subtipo: subtipo,
      fecha: Campos.valor(raiz, idFecha),
      importe: Campos.valor(raiz, idMonto),
      moneda: orig.moneda || c.config.moneda_base,
      id_origen: orig.id,
      id_destino: est.destino,
      detalle: Campos.valor(raiz, idDetalle)
    }, def.titulo.replace(/^\w/, function (m) { return m.toUpperCase(); }) + ' registrado');
  };

  return api;
}

function etiquetaDestino(subtipo) {
  return {
    PAGO_TARJETA: 'Qué tarjeta',
    PAGO_PRESTAMO: 'Qué préstamo',
    APORTE_OBJETIVO: 'Qué objetivo',
    MOVER_INVERSION: 'Qué inversión',
    TRANSFERENCIA: 'A qué cuenta'
  }[subtipo] || 'Destino';
}

function destinosDisponibles(subtipo, c) {
  if (subtipo === 'PAGO_TARJETA') {
    return (c.tarjetas || []).map(function (t) {
      return { id: t.id_tarjeta, nombre: t.nombre, icono: 'credit-card', color: t.color };
    });
  }
  if (subtipo === 'PAGO_PRESTAMO') {
    return (c.prestamos || []).map(function (p) {
      return { id: p.id_prestamo, nombre: p.nombre, icono: 'landmark', color: p.color };
    });
  }
  if (subtipo === 'APORTE_OBJETIVO') {
    return (c.objetivos || []).map(function (o) {
      return { id: o.id_objetivo, nombre: o.nombre, icono: o.icono || 'target',
               color: o.color_icono };
    });
  }
  if (subtipo === 'MOVER_INVERSION') {
    return (c.inversiones || []).map(function (i) {
      return { id: i.id_inversion, nombre: i.nombre, icono: 'chart-candlestick',
               color: i.color };
    });
  }
  return (c.cuentas || []).map(function (x) {
    return { id: x.id_cuenta, nombre: x.nombre, icono: x.icono || 'wallet', color: x.color };
  });
}
