/**
 * SOLVO — Alta y edición de conceptos de Control de caja. Manual 5 §A.3, §A.4.
 *
 * Un concepto es la mitad DECLARADA del flujo de caja —ingresos y gastos fijos—; los
 * compromisos de deuda y el ahorro comprometido se derivan solos y no tienen forma
 * aquí (§A.2). Solo se ofrecen los tres tipos que `Caja.gs` de verdad usa en su
 * cálculo: `GASTO_VARIABLE` existe en el esquema pero el control de caja nunca lo lee,
 * así que ofrecerlo aquí sería un campo que no hace nada.
 */

const TIPOS_CONCEPTO_CAJA = [
  ['INGRESO_FIJO', 'Ingreso fijo'], ['INGRESO_VARIABLE', 'Ingreso variable'],
  ['GASTO_FIJO', 'Gasto fijo']
];

const FRECUENCIAS_CAJA = [
  ['MENSUAL', 'Mensual'], ['QUINCENAL', 'Quincenal'], ['BIMESTRAL', 'Bimestral'],
  ['TRIMESTRAL', 'Trimestral'], ['SEMESTRAL', 'Semestral'], ['ANUAL', 'Anual']
];

function abrirSelectorFrecuencia(actual, alElegir) {
  const hoja = UI.abrirHoja({
    titulo: 'Frecuencia',
    html: '<ul class="pila pila-1">' + FRECUENCIAS_CAJA.map(function (f) {
      return '<li><button type="button" class="fila pulsable fila-opcion" data-frec="' + f[0] +
        '"><span class="crece t-card-title" style="text-align:left">' + f[1] + '</span>' +
        (actual === f[0] ? UI.ico('circle-check') : '') + '</button></li>';
    }).join('') + '</ul>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', function (e) {
        const b = e.target.closest('[data-frec]');
        if (!b) return;
        hoja.cerrar();
        alElegir(b.dataset.frec);
      });
    }
  });
}

function formularioConceptoCaja(existente) {
  const editando = !!existente;
  const idTipo = Campos.id(), idNombre = Campos.id(), idMonto = Campos.id();
  const idCategoria = Campos.id(), idFrecuencia = Campos.id(), idDiaMes = Campos.id();
  const idEsencial = Campos.id();

  const est = {
    tipo: (existente && existente.tipo) || 'GASTO_FIJO',
    categoria: existente && existente.id_categoria || '',
    frecuencia: (existente && existente.frecuencia) || 'MENSUAL'
  };

  const api = Formularios.abrirCascaron({
    titulo: editando ? 'Editar concepto' : 'Nuevo concepto',
    guardar: editando ? 'Guardar cambios' : 'Crear concepto',
    html:
      Campos.segmentado({ id: idTipo, etiqueta: 'Tipo', valor: est.tipo,
        opciones: TIPOS_CONCEPTO_CAJA.map(function (t) { return { valor: t[0], texto: t[1] }; }) }) +

      Campos.texto({ id: idNombre, etiqueta: 'Nombre', autofoco: !editando,
        valor: existente && existente.nombre,
        ayuda: 'Por ejemplo «Alquiler» o «Sueldo».' }) +

      Campos.monto({ id: idMonto, etiqueta: 'Monto estimado',
        valor: existente && existente.monto_estimado }) +

      Campos.selector({ id: idCategoria, etiqueta: 'Categoría', abre: 'categoria',
        opcional: true, vacio: 'Elegir categoría',
        texto: est.categoria ? (Formularios.buscarCategoria(est.categoria) || {}).nombre : '',
        icono: est.categoria ? (Formularios.buscarCategoria(est.categoria) || {}).icono : '',
        color: est.categoria ? (Formularios.buscarCategoria(est.categoria) || {}).color : '' }) +

      Campos.selector({ id: idFrecuencia, etiqueta: 'Frecuencia', abre: 'frecuencia',
        texto: nombreFrecuenciaCaja_(est.frecuencia) }) +

      Campos.entero({ id: idDiaMes, etiqueta: 'Día del mes', opcional: true,
        valor: existente && existente.dia_mes, placeholder: 'Ej. 5',
        ayuda: 'Cuándo esperas que ocurra. Opcional.' }) +

      // Solo tiene sentido para un gasto: clasifica necesidad/deseo en el reparto
      // 50/30/20 (Manual 5 §A.4). Un ingreso no se reparte en esos tres bloques.
      Campos.interruptor({ id: idEsencial, texto: 'Es una necesidad, no un deseo',
        valor: existente ? existente.es_esencial === true : false,
        ayuda: 'Clasifica el concepto en el reparto 50/30/20 de Control de caja.' })
  });

  const raiz = api.cuerpo;

  /** Grupo de categoría según el tipo — GASTO para gasto fijo, INGRESO para los dos
   *  ingresos. Se lee del segmentado en vivo, no de `est.tipo`: quedarse con el valor
   *  de creación es lo que hacía que, tras cambiar el tipo, el selector siguiera
   *  abriendo categorías del grupo equivocado. */
  function grupoCategoriaActual() {
    return Campos.valor(raiz, idTipo) === 'GASTO_FIJO' ? 'GASTO' : 'INGRESO';
  }

  raiz.addEventListener('click', function (e) {
    const sel = e.target.closest('[data-abre]');
    if (!sel) return;

    if (sel.dataset.abre === 'categoria') {
      Formularios.elegirCategoria(grupoCategoriaActual(), est.categoria, function (idCat) {
        est.categoria = idCat;
        const cat = Formularios.buscarCategoria(idCat);
        Campos.fijarSelector(sel, idCat, cat.nombre, cat.icono, cat.color);
        revisar();
      });
      return;
    }
    if (sel.dataset.abre === 'frecuencia') {
      abrirSelectorFrecuencia(est.frecuencia, function (frec) {
        est.frecuencia = frec;
        Campos.fijarSelector(sel, frec, nombreFrecuenciaCaja_(frec));
        revisar();
      });
    }
  });

  Campos.validarCon(raiz, idNombre, function () {
    return Campos.valor(raiz, idNombre) ? '' : 'Ponle un nombre.';
  });
  Campos.validarCon(raiz, idMonto, function () {
    const v = Campos.valor(raiz, idMonto);
    return (v !== null && v > 0) ? '' : 'El monto debe ser mayor a cero.';
  });

  function completo() {
    const monto = Campos.valor(raiz, idMonto);
    return !!Campos.valor(raiz, idNombre) && monto !== null && monto > 0;
  }

  /** A partir del estado, no del evento que lo cambió (mismo motivo que form-gasto.js):
   *  `Campos.conectar` registra su manejador del segmentado antes que el nuestro, así
   *  que para cuando esto corre `Campos.valor(raiz, idTipo)` ya está actualizado. */
  function sincronizar() {
    const esGasto = grupoCategoriaActual() === 'GASTO';

    raiz.querySelector('[data-campo="' + idEsencial + '"]').hidden = !esGasto;

    // Si la categoría elegida ya no es del grupo que corresponde al tipo actual, se
    // limpia: un «Sueldo» clasificado en «Comida» no significa nada.
    if (est.categoria) {
      const cat = Formularios.buscarCategoria(est.categoria);
      if (!cat || cat.grupo !== grupoCategoriaActual()) {
        est.categoria = '';
        Campos.fijarSelector(raiz.querySelector('#' + idCategoria), '', '');
      }
    }
  }

  function revisar() { sincronizar(); api.botón.disabled = !completo(); api.ensuciar(); }
  Campos.conectar(raiz, revisar);
  revisar();

  api.guardar = function () {
    if (!completo()) return;
    const cuerpo = {
      tipo: Campos.valor(raiz, idTipo),
      nombre: Campos.valor(raiz, idNombre),
      monto_estimado: Campos.valor(raiz, idMonto),
      id_categoria: est.categoria || '',
      frecuencia: est.frecuencia,
      dia_mes: Campos.valor(raiz, idDiaMes) || '',
      es_esencial: Campos.valor(raiz, idEsencial)
    };
    if (editando) cuerpo.id_concepto = existente.id_concepto;
    guardarConceptoCaja(api, editando, cuerpo,
      editando ? 'Concepto actualizado' : 'Concepto creado');
  };

  return api;
}

async function guardarConceptoCaja(api, editando, cuerpo, textoOk) {
  api.ocupado(true);
  try {
    await Api.llamar(editando ? 'caja.concepto.editar' : 'caja.concepto.crear', cuerpo);
    api.cerrar(true);
    UI.avisar(textoOk);
    // Sin el parpadeo de esqueleto de `App.recargar()` — este formulario solo lo abre
    // Control de caja.
    if (window.SolvoCaja) window.SolvoCaja.refrescarSilencioso();
    else App.recargar();
  } catch (e) {
    api.ocupado(false);
    UI.avisarError(e);
  }
}

function nombreFrecuenciaCaja_(valor) {
  const f = FRECUENCIAS_CAJA.filter(function (x) { return x[0] === valor; })[0];
  return f ? f[1] : '';
}
