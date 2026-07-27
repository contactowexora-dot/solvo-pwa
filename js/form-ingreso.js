/**
 * SOLVO — Formulario de INGRESO.
 * Manual 1 §9.1 · §7.
 *
 * Los ocho campos del §9.1. El que decide todo es el último:
 *
 *   · `Ya en cuenta` (por defecto) → suma al saldo y a los ingresos del periodo.
 *   · `Pendiente de ingresar` → **no** suma a ninguno de los dos. Alimenta la segunda línea
 *     del gráfico de ingresos y la pantalla de Pendientes de cobro.
 *
 * Es la distinción que evita el autoengaño más común en una app de finanzas: contar como
 * tuyo el dinero que todavía te deben.
 */
function formularioIngreso(prellenado) {
  const pre = prellenado || {};
  const c = Formularios.catalogos();
  const moneda = c.config.moneda_base;

  const idMonto = Campos.id();
  const idFecha = Campos.id();
  const idCuenta = Campos.id();
  const idResp = Campos.id();
  const idCategoria = Campos.id();
  const idFrecuencia = Campos.id();
  const idDescripcion = Campos.id();
  const idEstado = Campos.id();

  const principal = Formularios.responsablePrincipal();
  const est = {
    id_categoria: pre.id_categoria || '',
    id_subcategoria: pre.id_subcategoria || '',
    cuenta: '',
    responsables: principal ? [principal.id_responsable] : []
  };

  const api = Formularios.abrirCascaron({
    titulo: 'Registrar ingreso',
    guardar: 'Guardar ingreso',
    html:
      Campos.monto({ id: idMonto, etiqueta: 'Importe', autofoco: true,
        simbolo: simboloDe(moneda), valor: pre.importe || '' }) +

      // El estado va arriba, no al final como en la tabla del manual: cambia el significado
      // de todo lo demás, y decidirlo después de rellenar el resto obliga a releerlo.
      Campos.segmentado({ id: idEstado, etiqueta: 'Estado del ingreso',
        valor: 'EN_CUENTA', opciones: [
          { valor: 'EN_CUENTA', texto: 'Ya en cuenta' },
          { valor: 'PENDIENTE', texto: 'Pendiente' }] }) +

      Campos.fecha({ id: idFecha, etiqueta: 'Fecha del ingreso',
        valor: pre.fecha || Formularios.hoyISO() }) +

      Campos.selector({ id: idCuenta, etiqueta: 'Cuenta destino', abre: 'cuenta',
        vacio: 'Elegir cuenta' }) +

      Campos.selector({ id: idCategoria, etiqueta: 'Categoría del ingreso',
        abre: 'categoria', vacio: 'Elegir categoría' }) +

      Campos.selector({ id: idResp, etiqueta: 'Responsable', abre: 'responsables',
        vacio: 'Elegir',
        ayuda: 'Quién recibe el ingreso.' }) +

      Campos.segmentado({ id: idFrecuencia, etiqueta: 'Frecuencia', valor: 'UNICA',
        opciones: [
          { valor: 'UNICA', texto: 'Única' },
          { valor: 'QUINCENAL', texto: 'Quincenal' },
          { valor: 'MENSUAL', texto: 'Mensual' }],
        ayuda: 'Si se repite, quedará como ingreso recurrente.' }) +

      Campos.texto({ id: idDescripcion, etiqueta: 'Descripción', opcional: true,
        valor: pre.comercio || '', max: 200 })
  });

  const raiz = api.cuerpo;

  // El responsable por defecto ya está elegido: se muestra desde el principio.
  if (principal) {
    Campos.fijarSelector(raiz.querySelector('#' + idResp),
      principal.id_responsable, principal.nombre);
  }

  raiz.addEventListener('click', function (e) {
    const sel = e.target.closest('[data-abre]');
    if (!sel) return;

    if (sel.dataset.abre === 'categoria') {
      Formularios.elegirCategoria('INGRESO', est.id_categoria, function (idCat, idSub) {
        est.id_categoria = idCat; est.id_subcategoria = idSub || '';
        const cat = Formularios.buscarCategoria(idCat);
        const sub = idSub ? Formularios.buscarSub(idSub) : null;
        Campos.fijarSelector(sel, idCat,
          cat.nombre + (sub ? ' › ' + sub.nombre : ''), cat.icono, cat.color);
        revisar();
      });
    }

    if (sel.dataset.abre === 'cuenta') {
      // Solo cuentas: un ingreso no entra en una tarjeta de crédito.
      Formularios.elegirProducto(true, est.cuenta, function (clave) {
        est.cuenta = clave;
        const p = Formularios.buscarProducto(clave);
        Campos.fijarSelector(sel, clave, p.nombre, p.icono, p.color);
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

  // Un ingreso pendiente puede tener fecha futura —es cuándo esperas cobrarlo—; uno ya en
  // cuenta, no: si ya está, no puede estar mañana.
  function alCambiarEstado() {
    const pendiente = Campos.valor(raiz, idEstado) === 'PENDIENTE';
    const f = raiz.querySelector('#' + idFecha);
    if (pendiente) f.removeAttribute('max'); else f.setAttribute('max', Formularios.hoyISO());
    const campoF = raiz.querySelector('[data-campo="' + idFecha + '"]');
    const et = campoF.querySelector('.campo-etiqueta');
    et.textContent = pendiente ? 'Fecha esperada de cobro' : 'Fecha del ingreso';
  }
  // Se llama desde `revisar`, no desde un clic propio: `Campos.conectar` registra su
  // manejador después del mío, así que un escucha aquí leería el valor anterior.

  Campos.validarCon(raiz, idMonto, function () {
    const v = Campos.valor(raiz, idMonto);
    if (v === null) return 'Falta el importe.';
    if (v <= 0) return 'El importe tiene que ser mayor que cero.';
    return '';
  });
  Campos.validarCon(raiz, idFecha, function () {
    const v = Campos.valor(raiz, idFecha);
    if (!v) return 'Falta la fecha.';
    if (Campos.valor(raiz, idEstado) === 'EN_CUENTA' && v > Formularios.hoyISO()) {
      return 'Si ya está en cuenta, la fecha no puede ser futura.';
    }
    return '';
  });

  function completo() {
    const m = Campos.valor(raiz, idMonto);
    if (m === null || m <= 0) return false;
    if (!Campos.valor(raiz, idFecha)) return false;
    if (!est.id_categoria || !est.cuenta || !est.responsables.length) return false;
    if (Campos.valor(raiz, idEstado) === 'EN_CUENTA' &&
        Campos.valor(raiz, idFecha) > Formularios.hoyISO()) return false;
    return true;
  }

  function revisar() {
    alCambiarEstado();
    api.botón.disabled = !completo();
    api.ensuciar();
  }

  Campos.conectar(raiz, revisar);
  revisar();

  api.guardar = function () {
    if (!completo()) return;
    const cta = Formularios.buscarProducto(est.cuenta);
    const pendiente = Campos.valor(raiz, idEstado) === 'PENDIENTE';

    Formularios.enviar(api, 'movimiento.crear', {
      tipo: 'INGRESO',
      fecha: Campos.valor(raiz, idFecha),
      comercio: Campos.valor(raiz, idDescripcion),
      importe: Campos.valor(raiz, idMonto),
      moneda: cta.moneda || moneda,
      id_categoria: est.id_categoria,
      id_subcategoria: est.id_subcategoria,
      tipo_destino: 'CUENTA',
      id_destino: cta.id,
      responsables: est.responsables.length > 1 ? est.responsables : undefined,
      id_responsable: est.responsables.length > 1 ? undefined : est.responsables[0],
      estado_ingreso: pendiente ? 'PENDIENTE' : 'EN_CUENTA',
      frecuencia: Campos.valor(raiz, idFrecuencia),
      origen_registro: 'MANUAL'
    }, pendiente ? 'Ingreso pendiente registrado' : 'Ingreso registrado');
  };

  return api;
}
