/**
 * SOLVO — Alta y edición de objetivos de ahorro. Manual 1 §8.6.
 *
 * Mismos campos para crear y editar (Manual 4 §E.2 no distingue objetivos de productos en
 * ese sentido): nombre, monto meta, fecha de inicio, fecha esperada, ícono, color del
 * ícono, cuenta vinculada, nota. El **aporte mensual sugerido** se calcula en vivo con la
 * misma fórmula que usa el servidor —`(meta − ahorrado) / meses restantes`—, pero es solo
 * una vista previa: el servidor la vuelve a calcular al guardar y esa es la que manda.
 */

/** Los 24 del §6.9, más la búsqueda completa de Lucide que el manual también permite —
 *  esta pantalla ofrece la cuadrícula fija; buscar más allá queda para una versión futura. */
const ICONOS_OBJETIVO = [
  'target', 'plane', 'house', 'car-front', 'graduation-cap', 'heart', 'gem', 'baby',
  'dog', 'laptop', 'smartphone', 'camera', 'bike', 'palmtree', 'mountain', 'ship',
  'guitar', 'dumbbell', 'rocket', 'briefcase', 'piggy-bank', 'gift', 'cake', 'party-popper'
];

/** Los 12 tonos de categoría del §2.4. */
const COLORES_OBJETIVO = [
  '#E5484D', '#D6409F', '#8E4EC6', '#3E63DD', '#0091FF', '#00A2C7',
  '#12A594', '#30A46C', '#5B9A2E', '#F5A524', '#F76B15', '#8D8D8D'
];

function abrirPickerIconoColor(iconoInicial, colorInicial, alElegir) {
  let icono = iconoInicial || 'target';
  let color = colorInicial || '#4B5BE5';

  const hoja = UI.abrirHoja({
    titulo: 'Ícono y color',
    html:
      '<div class="fila" style="justify-content:center;margin-bottom:var(--sp-5)">' +
        '<span class="ico-cat picker-preview" style="--color-cat:' + color + '" data-preview>' +
          UI.ico(icono, 'ico-28') +
        '</span>' +
      '</div>' +
      '<p class="t-overline txt-2" style="margin-bottom:var(--sp-2)">Ícono</p>' +
      '<div class="picker-iconos" data-iconos>' + ICONOS_OBJETIVO.map(function (i) {
        return '<button type="button" class="picker-icono pulsable" data-icono="' + i +
          '" aria-pressed="' + (i === icono) + '" aria-label="' + i + '">' +
          UI.ico(i) + '</button>';
      }).join('') + '</div>' +
      '<p class="t-overline txt-2" style="margin:var(--sp-5) 0 var(--sp-2)">Color</p>' +
      '<div class="picker-colores" data-colores>' + COLORES_OBJETIVO.map(function (c) {
        return '<button type="button" class="picker-color pulsable" data-color="' + c +
          '" style="--color-swatch:' + c + '" aria-pressed="' + (c === color) +
          '" aria-label="Color ' + c + '"></button>';
      }).join('') + '</div>' +
      '<button type="button" class="btn btn-primario btn-bloque pulsable" ' +
        'style="margin-top:var(--sp-5)" data-confirmar>Listo</button>',
    alAbrir: function (raiz) {
      const preview = raiz.querySelector('[data-preview]');

      raiz.addEventListener('click', function (e) {
        const bi = e.target.closest('[data-icono]');
        if (bi) {
          icono = bi.dataset.icono;
          raiz.querySelectorAll('[data-icono]').forEach(function (b) {
            b.setAttribute('aria-pressed', String(b === bi));
          });
          preview.innerHTML = UI.ico(icono, 'ico-28');
          return;
        }
        const bc = e.target.closest('[data-color]');
        if (bc) {
          color = bc.dataset.color;
          raiz.querySelectorAll('[data-color]').forEach(function (b) {
            b.setAttribute('aria-pressed', String(b === bc));
          });
          preview.style.setProperty('--color-cat', color);
          return;
        }
        if (e.target.closest('[data-confirmar]')) {
          hoja.cerrar();
          alElegir(icono, color);
        }
      });
    }
  });
}

function formularioObjetivo(existente) {
  const editando = !!existente;
  const idNombre = Campos.id(), idMonto = Campos.id(), idInicio = Campos.id();
  const idEsperada = Campos.id(), idNota = Campos.id(), idCuenta = Campos.id();
  const idIconoColor = Campos.id();

  const est = {
    icono: (existente && existente.icono) || 'target',
    color: (existente && existente.color_icono) || '#4B5BE5',
    cuenta: existente && existente.id_cuenta_vinculada
      ? 'CUENTA:' + existente.id_cuenta_vinculada : ''
  };
  // Lo ya ahorrado no se pide: es derivado (§1.3) y en un objetivo nuevo siempre es 0.
  const ahorrado = editando ? existente.ahorrado : 0;

  const api = Formularios.abrirCascaron({
    titulo: editando ? 'Editar objetivo' : 'Nuevo objetivo',
    guardar: editando ? 'Guardar cambios' : 'Crear objetivo',
    html:
      Campos.texto({ id: idNombre, etiqueta: 'Nombre', autofoco: !editando,
        valor: existente && existente.nombre, ayuda: 'Por ejemplo «Viaje a Japón».' }) +

      Campos.monto({ id: idMonto, etiqueta: 'Monto meta',
        valor: existente && existente.monto_meta,
        simbolo: simboloDe(Formularios.catalogos().config.moneda_base) }) +

      Campos.fecha({ id: idInicio, etiqueta: 'Fecha de inicio',
        valor: (existente && existente.fecha_inicio) || Formularios.hoyISO() }) +

      Campos.fecha({ id: idEsperada, etiqueta: 'Fecha esperada',
        valor: existente && existente.fecha_esperada,
        ayuda: 'Con las dos fechas y el monto calculo el aporte mensual que necesitas.' }) +

      '<div class="campo" data-campo="' + idIconoColor + '">' +
        '<label class="campo-etiqueta t-label">Ícono y color</label>' +
        '<button type="button" class="campo-caja campo-selector pulsable" id="' + idIconoColor +
          '" data-tipo="iconocolor">' +
          '<span class="ico-cat ico-cat-sm" style="--color-cat:' + est.color + '" ' +
            'data-vista-previa>' + UI.ico(est.icono) + '</span>' +
          '<span class="crece campo-selector-texto">Elegir</span>' + UI.ico('chevron-right') +
        '</button>' +
        '<p class="campo-error t-caption"></p>' +
      '</div>' +

      Campos.selector({ id: idCuenta, etiqueta: 'Cuenta vinculada', abre: 'cuenta',
        opcional: true, vacio: 'Ninguna',
        texto: est.cuenta ? (Formularios.buscarProducto(est.cuenta) || {}).nombre : '',
        icono: est.cuenta ? (Formularios.buscarProducto(est.cuenta) || {}).icono : '',
        color: est.cuenta ? (Formularios.buscarProducto(est.cuenta) || {}).color : '' }) +

      Campos.texto({ id: idNota, etiqueta: 'Nota', opcional: true, max: 300,
        valor: existente && existente.nota }) +

      // El aporte sugerido es una VISTA PREVIA (§8.6): el servidor la recalcula al guardar.
      '<div class="tarjeta tarjeta-plana pila pila-1" data-aporte-sugerido>' +
        '<p class="t-overline txt-2">Aporte mensual sugerido</p>' +
        '<p class="t-caption txt-3">Completa el monto y las dos fechas para verlo.</p>' +
      '</div>'
  });

  const raiz = api.cuerpo;

  raiz.addEventListener('click', function (e) {
    if (e.target.closest('[data-tipo="iconocolor"]')) {
      abrirPickerIconoColor(est.icono, est.color, function (icono, color) {
        est.icono = icono; est.color = color;
        const btn = raiz.querySelector('#' + idIconoColor);
        btn.querySelector('[data-vista-previa]').style.setProperty('--color-cat', color);
        btn.querySelector('[data-vista-previa]').innerHTML = UI.ico(icono);
        btn.querySelector('.campo-selector-texto').textContent = 'Elegido';
        btn.querySelector('.campo-selector-texto').classList.remove('txt-3');
        Campos.limpiarError(btn.closest('.campo'));
        revisar();
      });
      return;
    }
    const selCta = e.target.closest('[data-abre="cuenta"]');
    if (!selCta) return;
    Formularios.elegirProducto(true, est.cuenta, function (clave) {
      est.cuenta = clave;
      const p = Formularios.buscarProducto(clave);
      Campos.fijarSelector(selCta, clave, p.nombre, p.icono, p.color);
      revisar();
    });
  });

  Campos.validarCon(raiz, idNombre, function () {
    return Campos.valor(raiz, idNombre) ? '' : 'Ponle un nombre.';
  });
  Campos.validarCon(raiz, idMonto, function () {
    const v = Campos.valor(raiz, idMonto);
    return (v !== null && v > 0) ? '' : 'La meta debe ser mayor a cero.';
  });
  Campos.validarCon(raiz, idEsperada, function () {
    const ini = Campos.valor(raiz, idInicio);
    const esp = Campos.valor(raiz, idEsperada);
    if (!esp) return 'Falta la fecha esperada.';
    if (ini && esp <= ini) return 'Tiene que ser posterior a la fecha de inicio.';
    return '';
  });

  function completo() {
    const monto = Campos.valor(raiz, idMonto);
    const ini = Campos.valor(raiz, idInicio);
    const esp = Campos.valor(raiz, idEsperada);
    return !!Campos.valor(raiz, idNombre) && monto !== null && monto > 0 &&
           !!ini && !!esp && esp > ini;
  }

  function actualizarAporteSugerido() {
    const caja = raiz.querySelector('[data-aporte-sugerido]');
    const monto = Campos.valor(raiz, idMonto);
    const ini = Campos.valor(raiz, idInicio);
    const esp = Campos.valor(raiz, idEsperada);
    const m = Formularios.catalogos().config.moneda_base;

    if (monto === null || monto <= 0 || !esp) {
      caja.innerHTML = '<p class="t-overline txt-2">Aporte mensual sugerido</p>' +
        '<p class="t-caption txt-3">Completa el monto y las dos fechas para verlo.</p>';
      return;
    }
    const falta = Math.max(monto - ahorrado, 0);
    const meses = Math.max(mesesEntreFechas(hoyOFecha(ini), esp), 1);
    const sugerido = falta > 0 ? falta / meses : 0;
    caja.innerHTML = '<p class="t-overline txt-2">Aporte mensual sugerido</p>' +
      '<p class="t-title num">' + UI.monto(sugerido, m, { sinSigno: true }) + '</p>' +
      (editando ? '<p class="t-caption txt-2">Ya ahorraste ' +
        UI.monto(ahorrado, m, { sinSigno: true }) + '.</p>' : '');
  }

  function revisar() {
    api.botón.disabled = !completo();
    api.ensuciar();
    actualizarAporteSugerido();
  }
  Campos.conectar(raiz, revisar);
  revisar();

  api.guardar = function () {
    if (!completo()) return;
    const cuerpo = {
      nombre: Campos.valor(raiz, idNombre),
      monto_meta: Campos.valor(raiz, idMonto),
      fecha_inicio: Campos.valor(raiz, idInicio),
      fecha_esperada: Campos.valor(raiz, idEsperada),
      icono: est.icono, color_icono: est.color,
      id_cuenta_vinculada: est.cuenta ? est.cuenta.split(':')[1] : '',
      nota: Campos.valor(raiz, idNota)
    };
    if (editando) cuerpo.id_objetivo = existente.id_objetivo;
    guardarObjetivo(api, editando, cuerpo,
      editando ? 'Objetivo actualizado' : 'Objetivo creado');
  };

  return api;
}

async function guardarObjetivo(api, editando, cuerpo, textoOk) {
  api.ocupado(true);
  try {
    await Api.llamar(editando ? 'objetivo.editar' : 'objetivo.crear', cuerpo);
    api.cerrar(true);
    UI.avisar(textoOk);
    App.recargar();
  } catch (e) {
    api.ocupado(false);
    UI.avisarError(e);
  }
}

/** Punto de partida del cómputo del aporte sugerido: hoy, salvo que el inicio sea futuro. */
function hoyOFecha(iniISO) {
  const hoy = Formularios.hoyISO();
  return iniISO > hoy ? iniISO : hoy;
}

function mesesEntreFechas(aISO, bISO) {
  const a = String(aISO).split('-').map(Number);
  const b = String(bISO).split('-').map(Number);
  return (b[0] - a[0]) * 12 + (b[1] - a[1]);
}
