/**
 * SOLVO — Formulario de GASTO.
 * Manual 1 §9.2 · §7 · Manual 2 §4.2.
 *
 * Los diez campos del §9.2, con sus tres reglas:
 *
 *   · el interruptor de cuotas **solo aparece si el producto es una tarjeta de crédito**;
 *   · `Compartido` exige responsables y el importe se divide entre ellos (en el servidor);
 *   · `No me corresponde` registra el movimiento pero lo excluye del gasto personal.
 */
function formularioGasto(prellenado) {
  const pre = prellenado || {};
  const c = Formularios.catalogos();
  const moneda = c.config.moneda_base;

  const idComercio = Campos.id();
  const idFecha = Campos.id();
  const idMonto = Campos.id();
  const idDetalle = Campos.id();
  const idCategoria = Campos.id();
  const idProducto = Campos.id();
  const idCuotas = Campos.id();
  const idNCuotas = Campos.id();
  const idResp = Campos.id();
  const idTipoResp = Campos.id();
  const idNecesario = Campos.id();

  // Estado que no vive en el DOM: lo que se elige en las hojas.
  const est = {
    id_categoria: pre.id_categoria || '',
    id_subcategoria: pre.id_subcategoria || '',
    producto: pre.producto || '',
    responsables: [((Formularios.responsablePrincipal() || {}).id_responsable) || '']
      .filter(Boolean)
  };

  const comerciosVistos = (c.comercios_frecuentes || []).slice(0, 40);

  const api = Formularios.abrirCascaron({
    titulo: 'Registrar gasto',
    guardar: 'Guardar gasto',
    html:
      Campos.monto({ id: idMonto, etiqueta: 'Monto', autofoco: true,
        simbolo: simboloDe(moneda), valor: pre.importe || '' }) +

      Campos.texto({ id: idComercio, etiqueta: 'Comercio', valor: pre.comercio || '',
        lista: 'comercios', opciones: comerciosVistos,
        ayuda: 'Dónde gastaste. Se usa para sugerirte la categoría la próxima vez.' }) +

      Campos.fecha({ id: idFecha, etiqueta: 'Fecha del consumo',
        valor: pre.fecha || Formularios.hoyISO(), max: Formularios.hoyISO() }) +

      Campos.selector({ id: idCategoria, etiqueta: 'Categoría', abre: 'categoria',
        vacio: 'Elegir categoría' }) +

      Campos.selector({ id: idProducto, etiqueta: 'Producto financiero',
        abre: 'producto', vacio: 'Elegir cuenta o tarjeta' }) +

      // Regla: el interruptor solo aparece si el producto es una tarjeta de crédito.
      Campos.interruptor({ id: idCuotas, texto: 'Operación en cuotas',
        valor: false, oculto: true,
        ayuda: 'Cada cuota se registra como un movimiento propio, en su mes.' }) +

      Campos.entero({ id: idNCuotas, etiqueta: 'Cantidad de cuotas', oculto: true,
        placeholder: '12', ayuda: 'Entre 2 y 60.' }) +

      Campos.segmentado({ id: idTipoResp, etiqueta: 'Tipo de responsabilidad',
        valor: 'PERSONAL', opciones: [
          { valor: 'PERSONAL', texto: 'Personal' },
          { valor: 'COMPARTIDO', texto: 'Compartido' },
          { valor: 'NO_CORRESPONDE', texto: 'No me toca' }] }) +

      Campos.selector({ id: idResp, etiqueta: 'Responsables', abre: 'responsables',
        vacio: 'Elegir', oculto: true }) +

      Campos.texto({ id: idDetalle, etiqueta: 'Detalle del consumo', opcional: true,
        valor: pre.detalle || '', max: 200 }) +

      Campos.segmentado({ id: idNecesario, etiqueta: '¿El consumo era necesario?',
        valor: '', opciones: [{ valor: 'SI', texto: 'Sí' }, { valor: 'NO', texto: 'No' }],
        ayuda: 'Opcional. Alimenta los insights de gasto evitable.' })
  });

  const raiz = api.cuerpo;

  // ── Selección desde hojas ─────────────────────────────────────────────────
  raiz.addEventListener('click', function (e) {
    const sel = e.target.closest('[data-abre]');
    if (!sel) return;

    if (sel.dataset.abre === 'categoria') {
      Formularios.elegirCategoria('GASTO', est.id_categoria, function (idCat, idSub) {
        est.id_categoria = idCat; est.id_subcategoria = idSub || '';
        const cat = Formularios.buscarCategoria(idCat);
        const sub = idSub ? Formularios.buscarSub(idSub) : null;
        Campos.fijarSelector(sel, idCat,
          cat.nombre + (sub ? ' › ' + sub.nombre : ''), cat.icono, cat.color);
        revisar();
      });
    }

    if (sel.dataset.abre === 'producto') {
      Formularios.elegirProducto(false, est.producto, function (clave) {
        est.producto = clave;
        const p = Formularios.buscarProducto(clave);
        Campos.fijarSelector(sel, clave,
          p.nombre + (p.numero_final ? ' ·••' + p.numero_final : ''), p.icono, p.color);
        // El símbolo del monto sigue a la moneda del producto: un gasto en una tarjeta en
        // dólares con «S/» delante es una lectura equivocada esperando a ocurrir.
        const simb = raiz.querySelector('[data-simbolo]');
        if (simb) simb.textContent = simboloDe(p.moneda || moneda);
        revisar();
      });
    }

    if (sel.dataset.abre === 'responsables') {
      Formularios.elegirResponsables(est.responsables, function (ids) {
        est.responsables = ids;
        Campos.fijarSelector(sel, ids.join(','), Formularios.nombresResponsables(ids));
        revisar();
      });
    }
  });

  /**
   * Reconcilia qué campos se ven, **a partir del estado**, no del evento que lo cambió.
   *
   * La versión anterior escuchaba el clic del interruptor y del segmentado por su cuenta, y
   * no funcionaba: `Campos.conectar` registra su manejador **después**, así que el mío leía
   * `aria-checked` y `data-valor` todavía sin actualizar y decidía con el valor anterior.
   * Depender del orden en que se registran los escuchas es frágil; leer el estado ya
   * asentado no lo es. Esta función es idempotente y se llama en cada cambio.
   */
  function sincronizar() {
    const prod = est.producto ? Formularios.buscarProducto(est.producto) : null;
    const esTarjeta = !!prod && prod.tipo === 'TARJETA';

    // El interruptor de cuotas solo existe con tarjeta de crédito (§9.2, regla del campo 7).
    const campoCuotas = raiz.querySelector('[data-campo="' + idCuotas + '"]');
    campoCuotas.hidden = !esTarjeta;
    const sw = raiz.querySelector('#' + idCuotas);
    if (!esTarjeta) sw.setAttribute('aria-checked', 'false');

    // Y la cantidad se despliega debajo del interruptor, no antes.
    const enCuotas = esTarjeta && sw.getAttribute('aria-checked') === 'true';
    const campoN = raiz.querySelector('[data-campo="' + idNCuotas + '"]');
    const seAcabaDeAbrir = campoN.hidden && enCuotas;
    campoN.hidden = !enCuotas;
    if (seAcabaDeAbrir) {
      raiz.querySelector('#' + idNCuotas).focus({ preventScroll: true });
    }

    // El selector de responsables solo aparece con `Compartido` (§9.2 campo 9).
    const compartido = Campos.valor(raiz, idTipoResp) === 'COMPARTIDO';
    raiz.querySelector('[data-campo="' + idResp + '"]').hidden = !compartido;
    if (compartido) {
      Campos.fijarSelector(raiz.querySelector('#' + idResp),
        est.responsables.join(','), Formularios.nombresResponsables(est.responsables));
    }
  }

  // ── Validación (§9 reglas 2 y 3) ──────────────────────────────────────────
  Campos.validarCon(raiz, idMonto, function () {
    const v = Campos.valor(raiz, idMonto);
    if (v === null) return 'Falta el monto.';
    if (v <= 0) return 'El monto tiene que ser mayor que cero.';
    return '';
  });
  Campos.validarCon(raiz, idFecha, function () {
    const v = Campos.valor(raiz, idFecha);
    if (!v) return 'Falta la fecha.';
    if (v > Formularios.hoyISO()) return 'La fecha no puede estar en el futuro.';
    return '';
  });
  Campos.validarCon(raiz, idNCuotas, function () {
    if (raiz.querySelector('[data-campo="' + idNCuotas + '"]').hidden) return '';
    const v = Campos.valor(raiz, idNCuotas);
    if (!v) return 'Indica cuántas cuotas.';
    if (v < 2) return 'Con una sola cuota, desactiva el interruptor.';
    if (v > 60) return 'El máximo son 60 cuotas.';
    return '';
  });

  function completo() {
    const m = Campos.valor(raiz, idMonto);
    if (m === null || m <= 0) return false;
    if (!Campos.valor(raiz, idFecha)) return false;
    if (!est.id_categoria) return false;
    if (!est.producto) return false;
    if (!raiz.querySelector('[data-campo="' + idNCuotas + '"]').hidden) {
      const nc = Campos.valor(raiz, idNCuotas);
      if (!nc || nc < 2 || nc > 60) return false;
    }
    if (Campos.valor(raiz, idTipoResp) === 'COMPARTIDO' && est.responsables.length < 2) {
      return false;
    }
    return true;
  }

  function revisar() {
    sincronizar();
    api.botón.disabled = !completo();
    api.ensuciar();
  }

  Campos.conectar(raiz, revisar);
  revisar();

  // ── Envío ─────────────────────────────────────────────────────────────────
  api.guardar = function () {
    if (!completo()) return;
    const prod = Formularios.buscarProducto(est.producto);
    const enCuotas = !raiz.querySelector('[data-campo="' + idNCuotas + '"]').hidden;
    const tipoResp = Campos.valor(raiz, idTipoResp);
    const necesario = Campos.valor(raiz, idNecesario);

    Formularios.enviar(api, 'movimiento.crear', {
      tipo: 'GASTO',
      fecha: Campos.valor(raiz, idFecha),
      comercio: Campos.valor(raiz, idComercio),
      detalle: Campos.valor(raiz, idDetalle),
      importe: Campos.valor(raiz, idMonto),
      moneda: prod.moneda || moneda,
      id_categoria: est.id_categoria,
      id_subcategoria: est.id_subcategoria,
      tipo_origen: prod.tipo,
      id_origen: prod.id,
      es_cuotas: enCuotas,
      cuota_total: enCuotas ? Campos.valor(raiz, idNCuotas) : 1,
      tipo_responsabilidad: tipoResp,
      // Con «Compartido» van todos; si no, uno solo. El reparto y el residuo del céntimo
      // los hace el servidor (Manual 2 §4.2), no este formulario.
      responsables: tipoResp === 'COMPARTIDO' ? est.responsables : undefined,
      id_responsable: tipoResp === 'COMPARTIDO' ? undefined : est.responsables[0],
      necesario: necesario === 'SI' ? true : (necesario === 'NO' ? false : undefined),
      origen_registro: 'MANUAL'
    }, enCuotas
      ? 'Gasto en ' + Campos.valor(raiz, idNCuotas) + ' cuotas registrado'
      : 'Gasto registrado');
  };

  return api;
}

function simboloDe(moneda) {
  return { PEN: 'S/', USD: 'US$', EUR: '€' }[String(moneda).toUpperCase()] || 'S/';
}
