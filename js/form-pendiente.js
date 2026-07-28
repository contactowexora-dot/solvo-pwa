/**
 * SOLVO — Modal de registro pre-llenado, desde Pendientes de registro. Manual 1 §9.3,
 * §8.11 · Manual 2 §7.
 *
 * Un correo de notificación bancaria ya trajo comercio, monto, fecha y producto — lo
 * único que la máquina NO puede inferir con fiabilidad es la clasificación: categoría,
 * cuotas, responsable y si era necesario. Eso es lo único que este formulario pide.
 *
 * `pendiente.registrar` (no `movimiento.crear`) es la acción de guardado: además de
 * crear el movimiento, marca la fila de `PENDIENTES_IMPORT` como `REGISTRADO` y guarda
 * la trazabilidad del correo — usar la acción genérica dejaría el pendiente reapareciendo
 * para siempre.
 */

/** Se llama al tocar una tarjeta del carrusel de Inicio. Solo tiene el resumen —sin
 *  `sugerencia` ni `falta`— así que primero pide el detalle completo. */
async function abrirPendienteRegistro(idPendiente) {
  const cerrarAviso = UI.avisar('Abriendo…', { ms: 6000 });
  let item;
  try {
    await Formularios.cargarCatalogos();
    const r = await Api.llamar('pendientes.listar', {});
    item = (r.items || []).filter(function (x) { return x.id_pendiente === idPendiente; })[0];
  } catch (e) { cerrarAviso(); return UI.avisarError(e); }
  cerrarAviso();

  if (!item) return UI.avisar('Ese pendiente ya no está disponible.', { error: true });
  if (String(item.estado) === 'REGISTRADO') {
    return UI.avisar('Ese correo ya se registró como movimiento.', { error: true });
  }
  formularioPendiente(item);
}

function formularioPendiente(item) {
  const m = item.moneda || Formularios.catalogos().config.moneda_base;
  const idComercio = Campos.id(), idCategoria = Campos.id(), idProducto = Campos.id();
  const idCuotas = Campos.id(), idNCuotas = Campos.id();
  const idTipoResp = Campos.id(), idResp = Campos.id(), idNecesario = Campos.id();

  const sugerencia = item.sugerencia || {};
  const est = {
    id_categoria: sugerencia.coincide ? (sugerencia.id_categoria || '') : '',
    id_subcategoria: sugerencia.coincide ? (sugerencia.id_subcategoria || '') : '',
    // Casi siempre ya viene reconocido por el número de tarjeta/cuenta; si no
    // (`SIN_PRODUCTO`), se elige aquí en vez de bloquear hasta que exista Centro de
    // Acciones (§8.7) para resolverlo.
    producto: item.tipo_producto && item.id_producto
      ? item.tipo_producto + ':' + item.id_producto : '',
    responsables: [sugerencia.id_responsable ||
      ((Formularios.responsablePrincipal() || {}).id_responsable) || ''].filter(Boolean)
  };

  const prodInicial = est.producto ? Formularios.buscarProducto(est.producto) : null;
  const catInicial = est.id_categoria ? Formularios.buscarCategoria(est.id_categoria) : null;
  const subInicial = est.id_subcategoria ? Formularios.buscarSub(est.id_subcategoria) : null;

  const api = Formularios.abrirCascaron({
    titulo: 'Confirmar movimiento',
    guardar: 'Guardar',
    html:
      // Lo que el correo ya trajo: no se vuelve a pedir, solo se muestra.
      '<div class="tarjeta tarjeta-plana pila pila-1" style="margin-bottom:var(--sp-5)">' +
        '<div class="fila-entre"><span class="t-label txt-2">Monto</span>' +
          '<span class="t-label num">' + UI.monto(item.importe, m, { sinSigno: true }) +
          '</span></div>' +
        '<div class="fila-entre"><span class="t-label txt-2">Fecha</span>' +
          '<span class="t-label">' + UI.esc(item.fecha || 'Sin fecha') + '</span></div>' +
        (prodInicial
          ? '<div class="fila-entre"><span class="t-label txt-2">Producto</span>' +
            '<span class="t-label">' + UI.esc(prodInicial.nombre) + '</span></div>'
          : '') +
      '</div>' +

      Campos.texto({ id: idComercio, etiqueta: 'Comercio', valor: item.comercio,
        autofoco: true }) +

      (prodInicial ? '' : Campos.selector({ id: idProducto, etiqueta: 'Cuenta o tarjeta',
        abre: 'producto', vacio: 'Elegir cuenta o tarjeta',
        ayuda: 'El correo no traía un número que reconociéramos.' })) +

      Campos.selector({ id: idCategoria, etiqueta: 'Categoría', abre: 'categoria',
        vacio: 'Elegir categoría',
        texto: catInicial ? (catInicial.nombre + (subInicial ? ' › ' + subInicial.nombre : ''))
                          : '',
        icono: catInicial ? catInicial.icono : '', color: catInicial ? catInicial.color : '' }) +

      Campos.interruptor({ id: idCuotas, texto: 'Operación en cuotas', valor: false,
        oculto: !prodInicial || prodInicial.tipo !== 'TARJETA',
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

      Campos.segmentado({ id: idNecesario, etiqueta: '¿El consumo era necesario?',
        valor: '', opciones: [{ valor: 'SI', texto: 'Sí' }, { valor: 'NO', texto: 'No' }],
        ayuda: 'Opcional. Alimenta los insights de gasto evitable.' }) +

      '<button type="button" class="btn btn-secundario btn-bloque pulsable" ' +
        'style="margin-top:var(--sp-5)" data-descartar>' +
        UI.ico('circle-x', 'ico-16') + 'No es mío / descartar</button>'
  });

  const raiz = api.cuerpo;
  let producto = prodInicial ? est.producto : '';

  raiz.addEventListener('click', function (e) {
    const sel = e.target.closest('[data-abre]');
    if (sel) {
      if (sel.dataset.abre === 'producto') {
        Formularios.elegirProducto(false, producto, function (clave) {
          producto = clave;
          const p = Formularios.buscarProducto(clave);
          Campos.fijarSelector(sel, clave,
            p.nombre + (p.numero_final ? ' ·••' + p.numero_final : ''), p.icono, p.color);
          revisar();
        });
      }
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
      if (sel.dataset.abre === 'responsables') {
        Formularios.elegirResponsables(est.responsables, function (ids) {
          est.responsables = ids;
          Campos.fijarSelector(sel, ids.join(','), Formularios.nombresResponsables(ids));
          revisar();
        });
      }
      return;
    }

    if (e.target.closest('[data-descartar]')) {
      confirmarDescarte(item, api);
    }
  });

  /** A partir del estado, no del evento — mismo motivo que form-gasto.js. */
  function sincronizar() {
    const esTarjeta = !!producto && Formularios.buscarProducto(producto).tipo === 'TARJETA';
    const campoCuotas = raiz.querySelector('[data-campo="' + idCuotas + '"]');
    campoCuotas.hidden = !esTarjeta;
    const sw = raiz.querySelector('#' + idCuotas);
    if (!esTarjeta) sw.setAttribute('aria-checked', 'false');

    const enCuotas = esTarjeta && sw.getAttribute('aria-checked') === 'true';
    raiz.querySelector('[data-campo="' + idNCuotas + '"]').hidden = !enCuotas;

    const compartido = Campos.valor(raiz, idTipoResp) === 'COMPARTIDO';
    raiz.querySelector('[data-campo="' + idResp + '"]').hidden = !compartido;
    if (compartido) {
      Campos.fijarSelector(raiz.querySelector('#' + idResp),
        est.responsables.join(','), Formularios.nombresResponsables(est.responsables));
    }
  }

  Campos.validarCon(raiz, idComercio, function () {
    return Campos.valor(raiz, idComercio) ? '' : 'Ponle un nombre.';
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
    if (!Campos.valor(raiz, idComercio)) return false;
    if (!producto) return false;
    if (!est.id_categoria) return false;
    if (!raiz.querySelector('[data-campo="' + idNCuotas + '"]').hidden) {
      const nc = Campos.valor(raiz, idNCuotas);
      if (!nc || nc < 2 || nc > 60) return false;
    }
    if (Campos.valor(raiz, idTipoResp) === 'COMPARTIDO' && est.responsables.length < 2) {
      return false;
    }
    return true;
  }

  function revisar() { sincronizar(); api.botón.disabled = !completo(); api.ensuciar(); }
  Campos.conectar(raiz, revisar);
  revisar();

  api.guardar = function () {
    if (!completo()) return;
    const prod = Formularios.buscarProducto(producto);
    const enCuotas = !raiz.querySelector('[data-campo="' + idNCuotas + '"]').hidden;
    const tipoResp = Campos.valor(raiz, idTipoResp);
    const necesario = Campos.valor(raiz, idNecesario);

    guardarPendiente(api, {
      id_pendiente: item.id_pendiente,
      comercio: Campos.valor(raiz, idComercio),
      id_categoria: est.id_categoria, id_subcategoria: est.id_subcategoria,
      tipo_producto: prod.tipo, id_producto: prod.id,
      es_cuotas: enCuotas, cuota_total: enCuotas ? Campos.valor(raiz, idNCuotas) : 1,
      tipo_responsabilidad: tipoResp,
      responsables: tipoResp === 'COMPARTIDO' ? est.responsables : undefined,
      id_responsable: tipoResp === 'COMPARTIDO' ? undefined : est.responsables[0],
      necesario: necesario === 'SI' ? true : (necesario === 'NO' ? false : undefined)
    }, enCuotas
      ? 'Registrado en ' + Campos.valor(raiz, idNCuotas) + ' cuotas'
      : 'Movimiento registrado');
  };

  return api;
}

async function guardarPendiente(api, cuerpo, textoOk) {
  api.ocupado(true);
  try {
    await Api.llamar('pendiente.registrar', cuerpo);
    api.cerrar(true);
    UI.avisar(textoOk);
    if (window.SolvoInicio) window.SolvoInicio.refrescarSilencioso();
    else App.recargar();
  } catch (e) {
    api.ocupado(false);
    UI.avisarError(e);
  }
}

function confirmarDescarte(item, api) {
  const hoja = UI.abrirHoja({
    titulo: 'Descartar «' + item.comercio + '»',
    html: '<p class="t-body txt-2" style="margin-bottom:var(--sp-5)">No se registrará ' +
      'ningún movimiento y este correo no volverá a aparecer como pendiente.</p>' +
      '<div class="pila pila-2">' +
        '<button class="btn btn-peligro btn-bloque pulsable" data-si>Descartar</button>' +
        '<button class="btn btn-secundario btn-bloque pulsable" data-no>Cancelar</button>' +
      '</div>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', async function (e) {
        if (e.target.closest('[data-no]')) { hoja.cerrar(); return; }
        if (!e.target.closest('[data-si]')) return;
        hoja.cerrar();
        try {
          await Api.llamar('pendiente.descartar', { id_pendiente: item.id_pendiente });
          api.cerrar(true);
          UI.avisar('Descartado');
          if (window.SolvoInicio) window.SolvoInicio.refrescarSilencioso();
          else App.recargar();
        } catch (err) { UI.avisarError(err); }
      });
    }
  });
}
