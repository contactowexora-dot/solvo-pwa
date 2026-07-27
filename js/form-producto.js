/**
 * SOLVO — Alta de productos financieros: cuenta y tarjeta.
 * Manual 1 §8.5 · Manual 5 §C.2 y §C.3 (fechas de tarjeta).
 *
 * Los préstamos y las inversiones llegan con la pantalla Productos completa, en el Paso 14.
 * Aquí están los dos que hacen falta para poder registrar un movimiento: sin una cuenta o una
 * tarjeta, el formulario de gasto no tiene dónde ponerlo.
 */

function formularioCuenta() {
  const c = Formularios.catalogos();
  const idNombre = Campos.id(), idBanco = Campos.id(), idTipo = Campos.id();
  const idMoneda = Campos.id(), idSaldo = Campos.id(), idFecha = Campos.id();
  const idUltimos4 = Campos.id();

  const api = Formularios.abrirCascaron({
    titulo: 'Nueva cuenta',
    guardar: 'Crear cuenta',
    html:
      Campos.texto({ id: idNombre, etiqueta: 'Nombre', autofoco: true,
        ayuda: 'Cómo la llamas tú. Por ejemplo «BCP Soles».' }) +

      Campos.texto({ id: idBanco, etiqueta: 'Banco', opcional: true }) +

      Campos.segmentado({ id: idTipo, etiqueta: 'Tipo', valor: 'CORRIENTE', opciones: [
        { valor: 'CORRIENTE', texto: 'Corriente' },
        { valor: 'AHORRO', texto: 'Ahorro' },
        { valor: 'EFECTIVO', texto: 'Efectivo' }] }) +

      // La moneda no se puede cambiar una vez hay movimientos (§E.2): conviene decirlo antes.
      Campos.segmentado({ id: idMoneda, etiqueta: 'Moneda',
        valor: c.config.moneda_base || 'PEN', opciones: [
          { valor: 'PEN', texto: 'S/ Soles' },
          { valor: 'USD', texto: 'US$ Dólares' },
          { valor: 'EUR', texto: '€ Euros' }],
        ayuda: 'No se podrá cambiar cuando la cuenta tenga movimientos.' }) +

      Campos.monto({ id: idSaldo, etiqueta: 'Saldo actual', valor: '',
        simbolo: simboloDe(c.config.moneda_base),
        ayuda: 'Cuánto hay ahora mismo. Es el punto de partida del saldo.' }) +

      Campos.fecha({ id: idFecha, etiqueta: 'Fecha de ese saldo',
        valor: Formularios.hoyISO(), max: Formularios.hoyISO(),
        ayuda: 'Los movimientos anteriores a esta fecha no cuentan para el saldo.' }) +

      Campos.texto({ id: idUltimos4, etiqueta: 'Últimos 4 dígitos', opcional: true, max: 4,
        ayuda: 'Sirven para reconocer los correos del banco automáticamente.' })
  });

  const raiz = api.cuerpo;

  // El símbolo del saldo sigue a la moneda elegida.
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
    enviarProducto(api, {
      tipo_producto: 'CUENTA',
      nombre: Campos.valor(raiz, idNombre),
      banco: Campos.valor(raiz, idBanco),
      tipo: Campos.valor(raiz, idTipo),
      moneda: Campos.valor(raiz, idMoneda),
      saldo_inicial: Campos.valor(raiz, idSaldo) || 0,
      fecha_saldo_inicial: Campos.valor(raiz, idFecha),
      numero_final: Campos.valor(raiz, idUltimos4),
      icono: { CORRIENTE: 'wallet', AHORRO: 'piggy-bank', EFECTIVO: 'banknote' }
             [Campos.valor(raiz, idTipo)] || 'wallet'
    }, 'Cuenta creada');
  };

  return api;
}

function formularioTarjeta() {
  const c = Formularios.catalogos();
  const idNombre = Campos.id(), idBanco = Campos.id(), idMarca = Campos.id();
  const idMoneda = Campos.id(), idLinea = Campos.id(), idCierre = Campos.id();
  const idVenc = Campos.id(), idTea = Campos.id(), idUltimos4 = Campos.id();
  const idCuentaPago = Campos.id();

  const est = { cuentaPago: '' };

  const api = Formularios.abrirCascaron({
    titulo: 'Nueva tarjeta',
    guardar: 'Crear tarjeta',
    html:
      Campos.texto({ id: idNombre, etiqueta: 'Nombre', autofoco: true,
        ayuda: 'Por ejemplo «Visa BBVA».' }) +

      Campos.texto({ id: idBanco, etiqueta: 'Banco', opcional: true }) +

      Campos.segmentado({ id: idMarca, etiqueta: 'Marca', valor: 'VISA', opciones: [
        { valor: 'VISA', texto: 'Visa' },
        { valor: 'MASTERCARD', texto: 'Master' },
        { valor: 'AMEX', texto: 'Amex' },
        { valor: 'OTRA', texto: 'Otra' }] }) +

      Campos.segmentado({ id: idMoneda, etiqueta: 'Moneda',
        valor: c.config.moneda_base || 'PEN', opciones: [
          { valor: 'PEN', texto: 'S/ Soles' },
          { valor: 'USD', texto: 'US$ Dólares' },
          { valor: 'EUR', texto: '€ Euros' }] }) +

      Campos.monto({ id: idLinea, etiqueta: 'Línea de crédito',
        simbolo: simboloDe(c.config.moneda_base) }) +

      // Manual 5 §C: los dos días son lo que gobierna en qué mes cae cada consumo.
      Campos.entero({ id: idCierre, etiqueta: 'Día de cierre', placeholder: '25',
        ayuda: 'El día del mes en que el banco cierra el estado de cuenta.' }) +

      Campos.entero({ id: idVenc, etiqueta: 'Día de pago', placeholder: '15',
        ayuda: 'El día del mes en que vence el pago. Si es antes que el cierre, ' +
               'se entiende que cae en el mes siguiente.' }) +

      Campos.selector({ id: idCuentaPago, etiqueta: 'Cuenta desde la que pagas',
        abre: 'cuenta', vacio: 'Elegir cuenta', opcional: true }) +

      Campos.texto({ id: idUltimos4, etiqueta: 'Últimos 4 dígitos', opcional: true, max: 4,
        ayuda: 'Con esto reconozco los correos del banco automáticamente.' }) +

      Campos.entero({ id: idTea, etiqueta: 'Tasa anual (TEA) en %', opcional: true,
        placeholder: '85', ayuda: 'Solo para estimar intereses. Puedes dejarlo vacío.' }) +

      '<p class="nota-formulario t-caption">' + UI.ico('info', 'ico-16') +
        '<span>Si el cierre o el pago caen en un día no hábil, Solvo los mueve solo: el ' +
        'cierre al día hábil anterior y el pago al siguiente.</span></p>'
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
    enviarProducto(api, {
      tipo_producto: 'TARJETA',
      nombre: Campos.valor(raiz, idNombre),
      banco: Campos.valor(raiz, idBanco),
      marca: Campos.valor(raiz, idMarca),
      moneda: Campos.valor(raiz, idMoneda),
      linea_credito: Campos.valor(raiz, idLinea),
      dia_cierre: Campos.valor(raiz, idCierre),
      dia_vencimiento: Campos.valor(raiz, idVenc),
      // El backend guarda la tasa como decimal (0.85), no como porcentaje.
      tasa_tea: tea ? tea / 100 : 0,
      numero_final: Campos.valor(raiz, idUltimos4),
      id_cuenta_pago: est.cuentaPago ? est.cuentaPago.split(':')[1] : ''
    }, 'Tarjeta creada');
  };

  return api;
}

/**
 * Envía y **recarga los catálogos**. Sin eso, el producto recién creado no aparecería en el
 * selector del formulario de gasto hasta recargar la app entera: los catálogos se cachean por
 * sesión, y crear uno los deja obsoletos al instante.
 */
async function enviarProducto(api, cuerpo, textoOk) {
  api.ocupado(true);
  try {
    await Api.llamar('producto.crear', cuerpo);
    Formularios.invalidarCatalogos();
    await Formularios.cargarCatalogos(true);
    api.cerrar(true);
    UI.avisar(textoOk);
    App.recargar();
  } catch (e) {
    api.ocupado(false);
    UI.avisarError(e);
  }
}
