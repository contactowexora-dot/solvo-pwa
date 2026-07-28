/**
 * SOLVO — Alta y edición de productos financieros: cuenta, tarjeta, préstamo, inversión.
 * Manual 1 §8.5 · Manual 4 §E.2 (edición y baja) · Manual 5 §C.2 y §C.3 (fechas de tarjeta).
 *
 * Los cuatro `formulario*` aceptan un segundo argumento opcional: la fila que devuelve
 * `productos.detalle` cuando se está EDITANDO. Sin él, el formulario crea. Es la misma
 * función en los dos casos —mismos campos, misma validación— porque el Manual 4 §E.2 dice
 * que «todos los campos son editables», así que no hay un subconjunto distinto que
 * justifique un formulario aparte.
 *
 * **La moneda deja de ser editable en cuanto el producto tiene un movimiento** (§E.2): en
 * vez de deshabilitar el segmentado —que sigue pareciendo tocable—, se sustituye por texto
 * plano con la explicación. Un control deshabilitado invita a probar si de verdad no
 * funciona; un texto no.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CUENTA
// ═══════════════════════════════════════════════════════════════════════════════

function formularioCuenta(existente) {
  const c = Formularios.catalogos();
  const editando = !!existente;
  const idNombre = Campos.id(), idBanco = Campos.id(), idTipo = Campos.id();
  const idMoneda = Campos.id(), idSaldo = Campos.id(), idFecha = Campos.id();
  const idUltimos4 = Campos.id(), idPatrimonio = Campos.id();

  const monedaEditable = !editando || existente.moneda_editable !== false;
  const monedaActual = (existente && existente.moneda) || c.config.moneda_base || 'PEN';

  const api = Formularios.abrirCascaron({
    titulo: editando ? 'Editar cuenta' : 'Nueva cuenta',
    guardar: editando ? 'Guardar cambios' : 'Crear cuenta',
    html:
      Campos.texto({ id: idNombre, etiqueta: 'Nombre', autofoco: !editando,
        valor: existente && existente.nombre,
        ayuda: 'Cómo la llamas tú. Por ejemplo «BCP Soles».' }) +

      Campos.texto({ id: idBanco, etiqueta: 'Banco', opcional: true,
        valor: existente && existente.banco }) +

      Campos.segmentado({ id: idTipo, etiqueta: 'Tipo',
        valor: (existente && existente.tipo_cuenta) || 'CORRIENTE', opciones: [
        { valor: 'CORRIENTE', texto: 'Corriente' },
        { valor: 'AHORRO', texto: 'Ahorro' },
        { valor: 'EFECTIVO', texto: 'Efectivo' }] }) +

      (monedaEditable
        ? Campos.segmentado({ id: idMoneda, etiqueta: 'Moneda', valor: monedaActual,
            opciones: [{ valor: 'PEN', texto: 'S/ Soles' }, { valor: 'USD', texto: 'US$ Dólares' },
                       { valor: 'EUR', texto: '€ Euros' }],
            ayuda: 'No se podrá cambiar cuando la cuenta tenga movimientos.' })
        : '<div class="campo"><label class="campo-etiqueta t-label">Moneda</label>' +
          '<p class="t-body">' + UI.esc(monedaActual) + '</p>' +
          '<p class="campo-ayuda t-caption txt-2">Esta cuenta ya tiene ' +
            existente.n_movimientos + ' movimientos: la moneda no se puede cambiar sin ' +
            'romper su histórico. Archívala y crea una nueva en la moneda correcta.</p>' +
          '</div>') +

      (editando ? '' : Campos.monto({ id: idSaldo, etiqueta: 'Saldo actual', valor: '',
        simbolo: simboloDe(monedaActual),
        ayuda: 'Cuánto hay ahora mismo. Es el punto de partida del saldo.' })) +

      (editando ? '' : Campos.fecha({ id: idFecha, etiqueta: 'Fecha de ese saldo',
        valor: Formularios.hoyISO(), max: Formularios.hoyISO(),
        ayuda: 'Los movimientos anteriores a esta fecha no cuentan para el saldo.' })) +

      Campos.texto({ id: idUltimos4, etiqueta: 'Últimos 4 dígitos', opcional: true, max: 4,
        valor: existente && existente.numero_final,
        ayuda: 'Sirven para reconocer los correos del banco automáticamente.' }) +

      Campos.interruptor({ id: idPatrimonio, texto: 'Incluir en el patrimonio neto',
        valor: existente ? existente.incluir_en_patrimonio !== false : true,
        ayuda: 'Apágalo para cuentas que no quieres que cuenten en tu patrimonio total.' })
  });

  const raiz = api.cuerpo;

  function sincronizar() {
    const simb = raiz.querySelector('[data-simbolo]');
    if (simb) simb.textContent = simboloDe(Campos.valor(raiz, idMoneda));
  }

  Campos.validarCon(raiz, idNombre, function () {
    return Campos.valor(raiz, idNombre) ? '' : 'Ponle un nombre.';
  });
  Campos.validarCon(raiz, idUltimos4, function () {
    const v = Campos.valor(raiz, idUltimos4);
    if (v && !/^\d{4}$/.test(v)) return 'Tienen que ser exactamente 4 dígitos.';
    return '';
  });

  function completo() {
    const v = Campos.valor(raiz, idUltimos4);
    return !!Campos.valor(raiz, idNombre) && (!v || /^\d{4}$/.test(v));
  }
  function revisar() {
    sincronizar();
    api.botón.disabled = !completo();
    api.ensuciar();
  }
  Campos.conectar(raiz, revisar);
  revisar();

  api.guardar = function () {
    if (!completo()) return;
    const cuerpo = {
      tipo_producto: 'CUENTA',
      nombre: Campos.valor(raiz, idNombre),
      banco: Campos.valor(raiz, idBanco),
      tipo: Campos.valor(raiz, idTipo),
      numero_final: Campos.valor(raiz, idUltimos4),
      incluir_en_patrimonio: Campos.valor(raiz, idPatrimonio),
      icono: { CORRIENTE: 'wallet', AHORRO: 'piggy-bank', EFECTIVO: 'banknote' }
             [Campos.valor(raiz, idTipo)] || 'wallet'
    };
    if (editando) {
      cuerpo.id_producto = existente.id_producto;
      if (monedaEditable) cuerpo.moneda = monedaActual;
    } else {
      cuerpo.moneda = Campos.valor(raiz, idMoneda);
      cuerpo.saldo_inicial = Campos.valor(raiz, idSaldo) || 0;
      cuerpo.fecha_saldo_inicial = Campos.valor(raiz, idFecha);
    }
    guardarProducto(api, editando, cuerpo,
      editando ? 'Cuenta actualizada' : 'Cuenta creada');
  };

  return api;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TARJETA — con el ajuste por día no hábil del Manual 5 §C.3
// ═══════════════════════════════════════════════════════════════════════════════

function formularioTarjeta(existente) {
  const c = Formularios.catalogos();
  const editando = !!existente;
  const idNombre = Campos.id(), idBanco = Campos.id(), idMarca = Campos.id();
  const idMoneda = Campos.id(), idLinea = Campos.id(), idCierre = Campos.id();
  const idVenc = Campos.id(), idTea = Campos.id(), idUltimos4 = Campos.id();
  const idCuentaPago = Campos.id(), idAjusteCierre = Campos.id(), idAjustePago = Campos.id();
  const idDirCierre = Campos.id(), idDirPago = Campos.id();

  const ajuste = (existente && existente.ajuste) || {};
  const monedaEditable = !editando || existente.moneda_editable !== false;
  const monedaActual = (existente && existente.moneda) || c.config.moneda_base || 'PEN';
  const est = { cuentaPago: existente && existente.id_cuenta_pago
    ? 'CUENTA:' + existente.id_cuenta_pago : '' };

  const api = Formularios.abrirCascaron({
    titulo: editando ? 'Editar tarjeta' : 'Nueva tarjeta',
    guardar: editando ? 'Guardar cambios' : 'Crear tarjeta',
    html:
      Campos.texto({ id: idNombre, etiqueta: 'Nombre', autofoco: !editando,
        valor: existente && existente.nombre, ayuda: 'Por ejemplo «Visa BBVA».' }) +

      Campos.texto({ id: idBanco, etiqueta: 'Banco', opcional: true,
        valor: existente && existente.banco }) +

      Campos.segmentado({ id: idMarca, etiqueta: 'Marca',
        valor: (existente && existente.marca) || 'VISA', opciones: [
        { valor: 'VISA', texto: 'Visa' }, { valor: 'MASTERCARD', texto: 'Master' },
        { valor: 'AMEX', texto: 'Amex' }, { valor: 'OTRA', texto: 'Otra' }] }) +

      (monedaEditable
        ? Campos.segmentado({ id: idMoneda, etiqueta: 'Moneda', valor: monedaActual, opciones: [
            { valor: 'PEN', texto: 'S/ Soles' }, { valor: 'USD', texto: 'US$ Dólares' },
            { valor: 'EUR', texto: '€ Euros' }] })
        : '<div class="campo"><label class="campo-etiqueta t-label">Moneda</label>' +
          '<p class="t-body">' + UI.esc(monedaActual) + '</p>' +
          '<p class="campo-ayuda t-caption txt-2">Ya tiene ' + existente.n_movimientos +
          ' movimientos: la moneda no se puede cambiar.</p></div>') +

      Campos.monto({ id: idLinea, etiqueta: 'Línea de crédito',
        valor: existente && existente.linea_credito, simbolo: simboloDe(monedaActual) }) +

      // Manual 5 §C: los dos días son lo que gobierna en qué mes cae cada consumo.
      Campos.entero({ id: idCierre, etiqueta: 'Día de cierre', placeholder: '25',
        valor: existente && existente.ajuste && existente.ajuste.dia_cierre,
        ayuda: 'El día del mes en que el banco cierra el estado de cuenta.' }) +

      Campos.interruptor({ id: idAjusteCierre,
        texto: 'Si el cierre cae en día no hábil, ajustar',
        valor: ajuste.ajusta_cierre_no_habil !== undefined ? ajuste.ajusta_cierre_no_habil : true }) +

      Campos.segmentado({ id: idDirCierre, etiqueta: 'Dirección del ajuste de cierre',
        valor: ajuste.direccion_ajuste_cierre || 'ANTERIOR', opciones: [
          { valor: 'ANTERIOR', texto: 'Día hábil anterior' },
          { valor: 'SIGUIENTE', texto: 'Día hábil siguiente' }] }) +

      Campos.entero({ id: idVenc, etiqueta: 'Día de pago', placeholder: '15',
        valor: existente && existente.ajuste && existente.ajuste.dia_vencimiento,
        ayuda: 'Si es antes que el cierre, se entiende que cae en el mes siguiente.' }) +

      Campos.interruptor({ id: idAjustePago,
        texto: 'Si el pago cae en día no hábil, ajustar',
        valor: ajuste.ajusta_pago_no_habil !== undefined ? ajuste.ajusta_pago_no_habil : true }) +

      Campos.segmentado({ id: idDirPago, etiqueta: 'Dirección del ajuste de pago',
        valor: ajuste.direccion_ajuste_pago || 'SIGUIENTE', opciones: [
          { valor: 'ANTERIOR', texto: 'Día hábil anterior' },
          { valor: 'SIGUIENTE', texto: 'Día hábil siguiente' }] }) +

      // Bloque obligatorio del §C.3: confirma la configuración ANTES de guardar, sin
      // esperar un mes para descubrir que estaba mal.
      '<div class="tarjeta tarjeta-plana pila pila-2" data-fechas-calculadas>' +
        '<p class="t-overline txt-2">Próximas fechas calculadas</p>' +
        '<div class="hueso hueso-linea" style="width:70%"></div>' +
        '<div class="hueso hueso-linea" style="width:60%"></div>' +
      '</div>' +

      Campos.selector({ id: idCuentaPago, etiqueta: 'Cuenta desde la que pagas',
        abre: 'cuenta', opcional: true, vacio: 'Elegir cuenta',
        texto: est.cuentaPago ? (Formularios.buscarProducto(est.cuentaPago) || {}).nombre : '',
        icono: est.cuentaPago ? (Formularios.buscarProducto(est.cuentaPago) || {}).icono : '',
        color: est.cuentaPago ? (Formularios.buscarProducto(est.cuentaPago) || {}).color : '' }) +

      Campos.texto({ id: idUltimos4, etiqueta: 'Últimos 4 dígitos', opcional: true, max: 4,
        valor: existente && existente.numero_final,
        ayuda: 'Con esto reconozco los correos del banco automáticamente.' }) +

      Campos.entero({ id: idTea, etiqueta: 'Tasa anual (TEA) en %', opcional: true,
        valor: existente && existente.tasa_tea ? Math.round(existente.tasa_tea * 100) : null,
        placeholder: '85', ayuda: 'Solo para estimar intereses. Puedes dejarlo vacío.' })
  });

  const raiz = api.cuerpo;

  raiz.addEventListener('click', function (e) {
    const sel = e.target.closest('[data-abre="cuenta"]');
    if (!sel) return;
    Formularios.elegirProducto(true, est.cuentaPago, function (clave) {
      est.cuentaPago = clave;
      const p = Formularios.buscarProducto(clave);
      Campos.fijarSelector(sel, clave, p.nombre, p.icono, p.color);
      revisar();
    });
  });

  function sincronizar() {
    const simb = raiz.querySelector('[data-simbolo]');
    if (simb) simb.textContent = simboloDe(Campos.valor(raiz, idMoneda));
  }

  function dia(v) { return v >= 1 && v <= 31; }

  Campos.validarCon(raiz, idNombre, function () {
    return Campos.valor(raiz, idNombre) ? '' : 'Ponle un nombre.';
  });
  Campos.validarCon(raiz, idLinea, function () {
    const v = Campos.valor(raiz, idLinea);
    if (v === null || v <= 0) return 'La línea de crédito debe ser mayor que cero.';
    return '';
  });
  Campos.validarCon(raiz, idCierre, function () {
    const v = Campos.valor(raiz, idCierre);
    if (!v) return 'Falta el día de cierre.';
    return dia(v) ? '' : 'Tiene que estar entre 1 y 31.';
  });
  Campos.validarCon(raiz, idVenc, function () {
    const v = Campos.valor(raiz, idVenc);
    if (!v) return 'Falta el día de pago.';
    return dia(v) ? '' : 'Tiene que estar entre 1 y 31.';
  });
  Campos.validarCon(raiz, idUltimos4, function () {
    const v = Campos.valor(raiz, idUltimos4);
    return (v && !/^\d{4}$/.test(v)) ? 'Tienen que ser exactamente 4 dígitos.' : '';
  });

  function completo() {
    const linea = Campos.valor(raiz, idLinea);
    const u4 = Campos.valor(raiz, idUltimos4);
    return !!Campos.valor(raiz, idNombre) &&
           linea !== null && linea > 0 &&
           dia(Campos.valor(raiz, idCierre)) && dia(Campos.valor(raiz, idVenc)) &&
           (!u4 || /^\d{4}$/.test(u4));
  }

  /**
   * Las «próximas fechas calculadas» se piden al servidor con los campos SIN guardar
   * (`Productos.fechasTarjeta`), con `debounce` de 400ms: es la única forma de que el
   * bloque reaccione mientras la persona mueve los interruptores, sin bombardear la API en
   * cada tecla del día de cierre.
   */
  let temporizadorFechas = null;
  function pedirFechas() {
    clearTimeout(temporizadorFechas);
    const cierre = Campos.valor(raiz, idCierre);
    const venc = Campos.valor(raiz, idVenc);
    if (!dia(cierre) || !dia(venc)) return;

    temporizadorFechas = setTimeout(async function () {
      try {
        const r = await Api.llamar('tarjeta.fechas', {
          dia_cierre: cierre, dia_vencimiento: venc,
          ajusta_cierre_no_habil: Campos.valor(raiz, idAjusteCierre),
          direccion_ajuste_cierre: Campos.valor(raiz, idDirCierre),
          ajusta_pago_no_habil: Campos.valor(raiz, idAjustePago),
          direccion_ajuste_pago: Campos.valor(raiz, idDirPago),
          n: 2
        });
        pintarFechas(r.fechas || []);
      } catch (e) { /* el bloque se queda con lo último que sí calculó */ }
    }, 400);
  }

  function pintarFechas(fechas) {
    const caja = raiz.querySelector('[data-fechas-calculadas]');
    if (!caja) return;
    if (!fechas.length) {
      caja.innerHTML = '<p class="t-overline txt-2">Próximas fechas calculadas</p>' +
        '<p class="t-caption txt-3">Completa cierre y pago para verlas.</p>';
      return;
    }
    caja.innerHTML = '<p class="t-overline txt-2">Próximas fechas calculadas</p>' +
      fechas.map(function (f) {
        return '<div class="fila-entre">' +
          '<span class="t-caption txt-2">Cierre ' + UI.esc(fechaLargaCorta(f.cierre)) +
            (f.cierreAjustado ? ' · ' + UI.esc(f.motivoCierre || 'ajustado') : '') + '</span>' +
          '<span class="t-caption txt-2">Paga ' + UI.esc(fechaLargaCorta(f.pago)) +
            (f.pagoAjustado ? ' · ' + UI.esc(f.motivoPago || 'ajustado') : '') + '</span>' +
        '</div>';
      }).join('');
  }

  function revisar() {
    sincronizar();
    api.botón.disabled = !completo();
    api.ensuciar();
    pedirFechas();
  }
  Campos.conectar(raiz, revisar);
  revisar();

  api.guardar = function () {
    if (!completo()) return;
    const tea = Campos.valor(raiz, idTea);
    const cuerpo = {
      tipo_producto: 'TARJETA',
      nombre: Campos.valor(raiz, idNombre),
      banco: Campos.valor(raiz, idBanco),
      marca: Campos.valor(raiz, idMarca),
      linea_credito: Campos.valor(raiz, idLinea),
      dia_cierre: Campos.valor(raiz, idCierre),
      dia_vencimiento: Campos.valor(raiz, idVenc),
      ajusta_cierre_no_habil: Campos.valor(raiz, idAjusteCierre),
      direccion_ajuste_cierre: Campos.valor(raiz, idDirCierre),
      ajusta_pago_no_habil: Campos.valor(raiz, idAjustePago),
      direccion_ajuste_pago: Campos.valor(raiz, idDirPago),
      // El backend guarda la tasa como decimal (0.85), no como porcentaje.
      tasa_tea: tea ? tea / 100 : 0,
      numero_final: Campos.valor(raiz, idUltimos4),
      id_cuenta_pago: est.cuentaPago ? est.cuentaPago.split(':')[1] : ''
    };
    if (editando) {
      cuerpo.id_producto = existente.id_producto;
      if (monedaEditable) cuerpo.moneda = monedaActual;
    } else {
      cuerpo.moneda = Campos.valor(raiz, idMoneda);
    }
    guardarProducto(api, editando, cuerpo, editando ? 'Tarjeta actualizada' : 'Tarjeta creada');
  };

  return api;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRÉSTAMO
// ═══════════════════════════════════════════════════════════════════════════════

const TIPOS_PRESTAMO = [
  ['PERSONAL', 'Personal'], ['HIPOTECARIO', 'Hipotecario'], ['VEHICULAR', 'Vehicular'],
  ['EDUCATIVO', 'Educativo'], ['OTRO', 'Otro']
];

function formularioPrestamo(existente) {
  const c = Formularios.catalogos();
  const editando = !!existente;
  const idNombre = Campos.id(), idEntidad = Campos.id(), idTipo = Campos.id();
  const idMoneda = Campos.id(), idMonto = Campos.id(), idDesembolso = Campos.id();
  const idPlazo = Campos.id(), idTea = Campos.id(), idVenc = Campos.id(), idCuentaPago = Campos.id();

  const monedaEditable = !editando || existente.moneda_editable !== false;
  const monedaActual = (existente && existente.moneda) || c.config.moneda_base || 'PEN';
  const est = { cuentaPago: existente && existente.id_cuenta_pago
    ? 'CUENTA:' + existente.id_cuenta_pago : '' };
  // El monto y el plazo ya generaron un cronograma: cambiarlos aquí lo invalida
  // (Productos.gs `cambiaCronograma_`), así que se avisa antes de tocarlos.
  const tieneCronograma = editando && existente.tiene_cronograma;

  const api = Formularios.abrirCascaron({
    titulo: editando ? 'Editar préstamo' : 'Nuevo préstamo',
    guardar: editando ? 'Guardar cambios' : 'Crear préstamo',
    html:
      Campos.texto({ id: idNombre, etiqueta: 'Nombre', autofoco: !editando,
        valor: existente && existente.nombre, ayuda: 'Por ejemplo «Préstamo Vehicular».' }) +

      Campos.texto({ id: idEntidad, etiqueta: 'Entidad', opcional: true,
        valor: existente && existente.entidad }) +

      Campos.segmentado({ id: idTipo, etiqueta: 'Tipo',
        valor: (existente && existente.tipo_prestamo) || 'PERSONAL',
        opciones: TIPOS_PRESTAMO.map(function (t) { return { valor: t[0], texto: t[1] }; }) }) +

      (monedaEditable
        ? Campos.segmentado({ id: idMoneda, etiqueta: 'Moneda', valor: monedaActual, opciones: [
            { valor: 'PEN', texto: 'S/ Soles' }, { valor: 'USD', texto: 'US$ Dólares' },
            { valor: 'EUR', texto: '€ Euros' }] })
        : '<div class="campo"><label class="campo-etiqueta t-label">Moneda</label>' +
          '<p class="t-body">' + UI.esc(monedaActual) + '</p></div>') +

      Campos.monto({ id: idMonto, etiqueta: 'Monto del préstamo',
        valor: existente && existente.monto_original, simbolo: simboloDe(monedaActual),
        ayuda: tieneCronograma
          ? 'Cambiarlo regenera el cronograma solo si ninguna cuota está pagada.' : '' }) +

      Campos.fecha({ id: idDesembolso, etiqueta: 'Fecha de desembolso',
        valor: (existente && existente.fecha_desembolso) || Formularios.hoyISO(),
        max: Formularios.hoyISO() }) +

      Campos.entero({ id: idPlazo, etiqueta: 'Plazo en meses', placeholder: '36',
        valor: existente && existente.plazo_meses }) +

      Campos.entero({ id: idTea, etiqueta: 'Tasa anual (TEA) en %', opcional: true,
        valor: existente && existente.tasa_tea ? Math.round(existente.tasa_tea * 10000) / 100 : null,
        placeholder: '18', ayuda: 'Se usa para calcular las cuotas del método francés.' }) +

      Campos.entero({ id: idVenc, etiqueta: 'Día de vencimiento de la cuota',
        placeholder: '15', valor: existente && existente.dia_vencimiento }) +

      Campos.selector({ id: idCuentaPago, etiqueta: 'Cuenta desde la que pagas',
        abre: 'cuenta', opcional: true, vacio: 'Elegir cuenta',
        texto: est.cuentaPago ? (Formularios.buscarProducto(est.cuentaPago) || {}).nombre : '',
        icono: est.cuentaPago ? (Formularios.buscarProducto(est.cuentaPago) || {}).icono : '',
        color: est.cuentaPago ? (Formularios.buscarProducto(est.cuentaPago) || {}).color : '' }) +

      (editando ? '' : '<p class="nota-formulario t-caption">' + UI.ico('info', 'ico-16') +
        '<span>Al crear el préstamo genero el cronograma completo de cuotas con el método ' +
        'francés, para poder separar capital e interés en cada pago.</span></p>')
  });

  const raiz = api.cuerpo;

  raiz.addEventListener('click', function (e) {
    const sel = e.target.closest('[data-abre="cuenta"]');
    if (!sel) return;
    Formularios.elegirProducto(true, est.cuentaPago, function (clave) {
      est.cuentaPago = clave;
      const p = Formularios.buscarProducto(clave);
      Campos.fijarSelector(sel, clave, p.nombre, p.icono, p.color);
      revisar();
    });
  });

  function sincronizar() {
    const simb = raiz.querySelector('[data-simbolo]');
    if (simb) simb.textContent = simboloDe(Campos.valor(raiz, idMoneda));
  }

  Campos.validarCon(raiz, idNombre, function () {
    return Campos.valor(raiz, idNombre) ? '' : 'Ponle un nombre.';
  });
  Campos.validarCon(raiz, idMonto, function () {
    const v = Campos.valor(raiz, idMonto);
    return (v !== null && v > 0) ? '' : 'El monto debe ser mayor a cero.';
  });
  Campos.validarCon(raiz, idPlazo, function () {
    const v = Campos.valor(raiz, idPlazo);
    if (!v) return 'Falta el plazo.';
    return (v >= 1 && v <= 480) ? '' : 'Tiene que estar entre 1 y 480 meses.';
  });
  Campos.validarCon(raiz, idVenc, function () {
    const v = Campos.valor(raiz, idVenc);
    if (!v) return 'Falta el día de vencimiento.';
    return (v >= 1 && v <= 31) ? '' : 'Tiene que estar entre 1 y 31.';
  });

  function completo() {
    const monto = Campos.valor(raiz, idMonto);
    const plazo = Campos.valor(raiz, idPlazo);
    const venc = Campos.valor(raiz, idVenc);
    return !!Campos.valor(raiz, idNombre) && monto !== null && monto > 0 &&
           plazo >= 1 && plazo <= 480 && venc >= 1 && venc <= 31;
  }
  function revisar() {
    sincronizar();
    api.botón.disabled = !completo();
    api.ensuciar();
  }
  Campos.conectar(raiz, revisar);
  revisar();

  api.guardar = function () {
    if (!completo()) return;
    const tea = Campos.valor(raiz, idTea);
    const cuerpo = {
      tipo_producto: 'PRESTAMO',
      nombre: Campos.valor(raiz, idNombre),
      entidad: Campos.valor(raiz, idEntidad),
      tipo: Campos.valor(raiz, idTipo),
      monto_original: Campos.valor(raiz, idMonto),
      fecha_desembolso: Campos.valor(raiz, idDesembolso),
      plazo_meses: Campos.valor(raiz, idPlazo),
      tasa_tea: tea ? tea / 100 : 0,
      dia_vencimiento: Campos.valor(raiz, idVenc),
      id_cuenta_pago: est.cuentaPago ? est.cuentaPago.split(':')[1] : ''
    };
    if (editando) {
      cuerpo.id_producto = existente.id_producto;
      if (monedaEditable) cuerpo.moneda = monedaActual;
    } else {
      cuerpo.moneda = Campos.valor(raiz, idMoneda);
    }
    guardarProducto(api, editando, cuerpo,
      editando ? 'Préstamo actualizado' : 'Préstamo creado', function (r) {
        if (r && r.avisos && r.avisos.length) UI.avisar(r.avisos.join(' '));
      });
  };

  return api;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVERSIÓN
// ═══════════════════════════════════════════════════════════════════════════════

/** Enum de `INVERSIONES.tipo_activo`, con el ícono y color que le asigno automáticamente
 *  (Manual 1 §8.5 no pide elegir color aquí; solo Objetivos lo pide en el §8.6). */
/**
 * Colores en HEX literal, no `var(--token)`: este color se GUARDA en `INVERSIONES.color`
 * (Manual 4 §E.2, mismo criterio que `CATEGORIAS.color` en `Semillas.gs`) y de ahí sale
 * directo a `--color-cat` al pintar. Un `var(--accent)` guardado tal cual, y luego
 * despojado de `var()` y paréntesis para «convertirlo en hex», deja el token suelto
 * `--accent` como valor de la propiedad — CSS inválido que no pinta nada.
 */
const TIPOS_ACTIVO = [
  ['ACCIONES', 'Acciones', 'chart-candlestick', '#4B5BE5'],
  ['ETF', 'ETF', 'layers', '#3E63DD'],
  ['FONDO_MUTUO', 'Fondo mutuo', 'boxes', '#3E63DD'],
  ['DEPOSITO_PLAZO', 'Depósito a plazo', 'vault', '#0091FF'],
  ['CRIPTO', 'Criptomonedas', 'bitcoin', '#F5A524'],
  ['BIEN_RAIZ', 'Bien raíz', 'building-2', '#8E4EC6'],
  ['BONO', 'Bono', 'scroll-text', '#0091FF'],
  ['DIVISA', 'Divisas', 'arrow-left-right', '#00A2C7'],
  ['OTRO', 'Otro activo', 'gem', '#12A594']
];

function infoTipoActivo(valor) {
  return TIPOS_ACTIVO.filter(function (t) { return t[0] === valor; })[0] || TIPOS_ACTIVO[8];
}

function elegirTipoActivo(actual, alElegir) {
  const hoja = UI.abrirHoja({
    titulo: 'Tipo de activo',
    html: '<ul class="pila">' + TIPOS_ACTIVO.map(function (t) {
      return '<li><button type="button" class="fila pulsable fila-opcion" data-tipo="' + t[0] +
        '"' + (t[0] === actual ? ' aria-current="true"' : '') + '>' +
        '<span class="ico-cat ico-cat-sm" style="--color-cat:' + t[3] + '">' + UI.ico(t[2]) +
        '</span><span class="crece t-card-title" style="text-align:left">' + t[1] + '</span>' +
        (t[0] === actual ? UI.ico('check') : '') + '</button></li>';
    }).join('') + '</ul>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', function (e) {
        const b = e.target.closest('[data-tipo]');
        if (!b) return;
        hoja.cerrar();
        alElegir(b.dataset.tipo);
      });
    }
  });
}

function formularioInversion(existente) {
  const c = Formularios.catalogos();
  const editando = !!existente;
  const idNombre = Campos.id(), idTicker = Campos.id(), idMoneda = Campos.id();
  const idTipo = Campos.id(), idFecha = Campos.id(), idCuentaOrigen = Campos.id();

  const monedaEditable = !editando || existente.moneda_editable !== false;
  const monedaActual = (existente && existente.moneda) || c.config.moneda_base || 'PEN';
  const est = {
    tipoActivo: (existente && existente.tipo_activo) || 'OTRO',
    cuentaOrigen: existente && existente.id_cuenta_origen
      ? 'CUENTA:' + existente.id_cuenta_origen : ''
  };

  const api = Formularios.abrirCascaron({
    titulo: editando ? 'Editar inversión' : 'Nueva inversión',
    guardar: editando ? 'Guardar cambios' : 'Crear inversión',
    html:
      Campos.texto({ id: idNombre, etiqueta: 'Nombre', autofoco: !editando,
        valor: existente && existente.nombre, ayuda: 'Por ejemplo «ETF S&P 500».' }) +

      Campos.selector({ id: idTipo, etiqueta: 'Tipo de activo', abre: 'tipo-activo',
        valor: est.tipoActivo, texto: infoTipoActivo(est.tipoActivo)[1],
        icono: infoTipoActivo(est.tipoActivo)[2], color: infoTipoActivo(est.tipoActivo)[3] }) +

      Campos.texto({ id: idTicker, etiqueta: 'Ticker', opcional: true,
        valor: existente && existente.ticker, ayuda: 'Por ejemplo «VOO». Solo informativo.' }) +

      (monedaEditable
        ? Campos.segmentado({ id: idMoneda, etiqueta: 'Moneda', valor: monedaActual, opciones: [
            { valor: 'PEN', texto: 'S/ Soles' }, { valor: 'USD', texto: 'US$ Dólares' },
            { valor: 'EUR', texto: '€ Euros' }] })
        : '<div class="campo"><label class="campo-etiqueta t-label">Moneda</label>' +
          '<p class="t-body">' + UI.esc(monedaActual) + '</p></div>') +

      Campos.fecha({ id: idFecha, etiqueta: 'Fecha de inicio',
        valor: (existente && existente.fecha_inicio) || Formularios.hoyISO(),
        max: Formularios.hoyISO() }) +

      Campos.selector({ id: idCuentaOrigen, etiqueta: 'Cuenta de origen', abre: 'cuenta',
        opcional: true, vacio: 'Elegir cuenta',
        texto: est.cuentaOrigen ? (Formularios.buscarProducto(est.cuentaOrigen) || {}).nombre : '',
        icono: est.cuentaOrigen ? (Formularios.buscarProducto(est.cuentaOrigen) || {}).icono : '',
        color: est.cuentaOrigen ? (Formularios.buscarProducto(est.cuentaOrigen) || {}).color : '' }) +

      '<p class="nota-formulario t-caption">' + UI.ico('info', 'ico-16') +
        '<span>El valor de mercado se actualiza aportando desde «Mover dinero → Mover a ' +
        'inversión»; aquí solo se da de alta el activo.</span></p>'
  });

  const raiz = api.cuerpo;

  raiz.addEventListener('click', function (e) {
    const selTipo = e.target.closest('[data-abre="tipo-activo"]');
    if (selTipo) {
      elegirTipoActivo(est.tipoActivo, function (v) {
        est.tipoActivo = v;
        const info = infoTipoActivo(v);
        Campos.fijarSelector(selTipo, v, info[1], info[2], info[3]);
        revisar();
      });
      return;
    }
    const selCta = e.target.closest('[data-abre="cuenta"]');
    if (!selCta) return;
    Formularios.elegirProducto(true, est.cuentaOrigen, function (clave) {
      est.cuentaOrigen = clave;
      const p = Formularios.buscarProducto(clave);
      Campos.fijarSelector(selCta, clave, p.nombre, p.icono, p.color);
      revisar();
    });
  });

  function sincronizar() {
    const simb = raiz.querySelector('[data-simbolo]');
    if (simb) simb.textContent = simboloDe(Campos.valor(raiz, idMoneda));
  }

  Campos.validarCon(raiz, idNombre, function () {
    return Campos.valor(raiz, idNombre) ? '' : 'Ponle un nombre.';
  });

  function completo() { return !!Campos.valor(raiz, idNombre); }
  function revisar() {
    sincronizar();
    api.botón.disabled = !completo();
    api.ensuciar();
  }
  Campos.conectar(raiz, revisar);
  revisar();

  api.guardar = function () {
    if (!completo()) return;
    const cuerpo = {
      tipo_producto: 'INVERSION',
      nombre: Campos.valor(raiz, idNombre),
      tipo_activo: est.tipoActivo,
      ticker: Campos.valor(raiz, idTicker),
      fecha_inicio: Campos.valor(raiz, idFecha),
      id_cuenta_origen: est.cuentaOrigen ? est.cuentaOrigen.split(':')[1] : '',
      color: infoTipoActivo(est.tipoActivo)[3]
    };
    if (editando) {
      cuerpo.id_producto = existente.id_producto;
      if (monedaEditable) cuerpo.moneda = monedaActual;
    } else {
      cuerpo.moneda = Campos.valor(raiz, idMoneda);
    }
    guardarProducto(api, editando, cuerpo,
      editando ? 'Inversión actualizada' : 'Inversión creada');
  };

  return api;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUARDAR Y ARCHIVAR — compartido por los cuatro tipos
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Envía y **recarga los catálogos**. Sin eso, el producto recién creado o editado no se
 * vería en el selector del formulario de gasto hasta recargar la app entera: los
 * catálogos se cachean por sesión, y crear o cambiar uno los deja obsoletos al instante.
 */
async function guardarProducto(api, editando, cuerpo, textoOk, alTerminar) {
  api.ocupado(true);
  try {
    const r = await Api.llamar(editando ? 'producto.editar' : 'producto.crear', cuerpo);
    Formularios.invalidarCatalogos();
    await Formularios.cargarCatalogos(true);
    api.cerrar(true);
    UI.avisar(textoOk);
    if (alTerminar) alTerminar(r);
    App.recargar();
  } catch (e) {
    api.ocupado(false);
    UI.avisarError(e);
  }
}

/**
 * Baja de un producto (Manual 1 §11.6 · Manual 4 §E.2): primero se pregunta al servidor
 * sin `confirmar`, que devuelve cuántos movimientos tiene y si archiva o elimina en
 * firme; solo entonces se muestra el diálogo con el mensaje EXACTO que da el backend, y se
 * repite la llamada con `confirmar: true`.
 */
async function archivarProducto(tipoProducto, idProducto, nombre) {
  let info;
  try {
    info = await Api.llamar('producto.archivar', {
      tipo_producto: tipoProducto, id_producto: idProducto
    });
  } catch (e) { return UI.avisarError(e); }

  const esArchivar = info.accion === 'ARCHIVAR';
  const hoja = UI.abrirHoja({
    titulo: (esArchivar ? 'Archivar' : 'Eliminar') + ' «' + nombre + '»',
    html:
      '<p class="t-body txt-2" style="margin-bottom:var(--sp-5)">' + UI.esc(info.mensaje) + '</p>' +
      '<div class="pila pila-2">' +
        '<button class="btn btn-peligro btn-bloque pulsable" data-si>' +
          (esArchivar ? 'Archivar' : 'Eliminar') + '</button>' +
        '<button class="btn btn-secundario btn-bloque pulsable" data-no>Cancelar</button>' +
      '</div>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', async function (e) {
        if (e.target.closest('[data-no]')) return hoja.cerrar();
        if (!e.target.closest('[data-si]')) return;
        hoja.cerrar();
        try {
          await Api.llamar('producto.archivar', {
            tipo_producto: tipoProducto, id_producto: idProducto, confirmar: true
          });
          Formularios.invalidarCatalogos();
          await Formularios.cargarCatalogos(true);
          UI.avisar(esArchivar ? 'Producto archivado' : 'Producto eliminado');
          App.recargar();
        } catch (e2) { UI.avisarError(e2); }
      });
    }
  });
}

/** «14 jul» — para el bloque de fechas calculadas, más corto que `fechaCorta` de otras
 *  pantallas porque aquí conviven dos fechas en la misma fila. */
function fechaLargaCorta(iso) {
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const p = String(iso).split('-');
  if (p.length !== 3) return String(iso);
  return Number(p[2]) + ' ' + (MESES[Number(p[1]) - 1] || '');
}
