/**
 * SOLVO — Campos de formulario.
 * Manual 1 §9 (reglas transversales) · Manual 3 §7.7.
 *
 * LAS SIETE REGLAS TRANSVERSALES DEL §9, que este archivo implementa una vez para que los
 * tres formularios no las reimplementen —ni las olviden— cada uno a su manera:
 *
 *   1. Etiqueta SIEMPRE visible encima del campo. Nunca solo placeholder: al escribir, un
 *      placeholder desaparece y el campo se queda sin decir qué es.
 *   2. Error junto al campo, no en una lista al inicio.
 *   3. Validación **al perder el foco**, no mientras se escribe. Corregir a alguien en mitad
 *      de la primera letra es hostil.
 *   4. Teclado numérico para montos, con separadores automáticos al escribir.
 *   5. El campo de monto recibe el foco al abrir.
 *   6. Botón primario fijo al pie, deshabilitado hasta que el formulario sea válido.
 *   7. Cerrar con cambios sin guardar → confirmación.
 */
const Campos = (function () {

  let n = 0;
  function id() { return 'c' + (++n); }

  /** El id lo puede fijar quien construye el campo, para poder referenciarlo
      después sin reemplazos de cadena. */
  function idDe(op) { return (op && op.id) || id(); }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVOLTURA COMÚN
  // ═══════════════════════════════════════════════════════════════════════════

  function envolver(campoId, etiqueta, control, ayuda, op) {
    op = op || {};
    return '<div class="campo" data-campo="' + campoId + '"' +
             (op.oculto ? ' hidden' : '') + '>' +
      '<label class="campo-etiqueta t-label" for="' + campoId + '">' +
        UI.esc(etiqueta) + (op.opcional ? ' <span class="txt-3">(opcional)</span>' : '') +
      '</label>' +
      control +
      (ayuda ? '<p class="campo-ayuda t-caption txt-2">' + UI.esc(ayuda) + '</p>' : '') +
      // El hueco del error existe siempre pero vacío: si apareciera y desapareciera,
      // el formulario entero daría un salto vertical en cada validación.
      '<p class="campo-error t-caption" role="alert"></p>' +
    '</div>';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MONTO (§9 reglas 4 y 5)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * `inputmode="decimal"` y no `type="number"`: el número nativo no admite separadores de
   * miles, y en iOS su teclado no trae el punto decimal en todos los locales. Con texto +
   * inputmode se controla el formato y el teclado sigue siendo el numérico.
   */
  function monto(op) {
    const cid = idDe(op);
    const control =
      '<div class="campo-monto">' +
        '<span class="campo-simbolo t-card-title txt-2" data-simbolo>' +
          UI.esc(op.simbolo || 'S/') + '</span>' +
        '<input class="campo-control campo-monto-input num" id="' + cid + '" ' +
          'inputmode="decimal" autocomplete="off" enterkeyhint="next" ' +
          'placeholder="0.00" value="' + UI.esc(op.valor || '') + '" ' +
          'data-tipo="monto"' + (op.autofoco ? ' data-autofoco="1"' : '') + '>' +
      '</div>';
    return envolver(cid, op.etiqueta, control, op.ayuda, op);
  }

  /**
   * Separadores de miles mientras se escribe, conservando la posición del cursor.
   *
   * Reescribir el valor de un input mueve el cursor al final. Editando «1,234.56» por la
   * mitad, eso salta al final en cada tecla y hace el campo inusable. Se cuentan los dígitos
   * a la izquierda del cursor y se recoloca donde le corresponde tras el reformateo.
   */
  function formatearMonto(input) {
    const antes = input.value;
    const pos = input.selectionStart;
    const digitosIzquierda = antes.slice(0, pos).replace(/[^\d]/g, '').length;

    let v = antes.replace(/[^\d.,]/g, '').replace(/,/g, '');
    const partes = v.split('.');
    let entero = partes[0] || '';
    // Un solo punto decimal y como mucho dos decimales.
    let decimal = partes.length > 1 ? '.' + partes.slice(1).join('').slice(0, 2) : '';

    entero = entero.replace(/^0+(?=\d)/, '');
    const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const nuevo = conMiles + decimal;
    if (nuevo === antes) return;

    input.value = nuevo;

    let vistos = 0, cursor = nuevo.length;
    for (let i = 0; i < nuevo.length; i++) {
      if (/\d/.test(nuevo[i])) vistos++;
      if (vistos === digitosIzquierda) { cursor = i + 1; break; }
    }
    if (digitosIzquierda === 0) cursor = 0;
    try { input.setSelectionRange(cursor, cursor); } catch (e) { /* input sin selección */ }
  }

  function leerMonto(input) {
    const v = String(input.value).replace(/,/g, '').trim();
    if (!v) return null;
    const num = parseFloat(v);
    return isNaN(num) ? null : num;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXTO, FECHA, NÚMERO
  // ═══════════════════════════════════════════════════════════════════════════

  function texto(op) {
    const cid = idDe(op);
    const control =
      '<div class="campo-caja">' +
        '<input class="campo-control" id="' + cid + '" type="text" ' +
          'value="' + UI.esc(op.valor || '') + '" ' +
          'autocomplete="' + UI.esc(op.autocomplete || 'off') + '" ' +
          'enterkeyhint="next" maxlength="' + (op.max || 120) + '" ' +
          'data-tipo="texto"' + (op.lista ? ' list="' + op.lista + '"' : '') + '>' +
      '</div>' +
      (op.opciones ? listaDatos(op.lista, op.opciones) : '');
    return envolver(cid, op.etiqueta, control, op.ayuda, op);
  }

  /** `<datalist>` para el autocompletado de comercio (§9.2 campo 1). */
  function listaDatos(idLista, opciones) {
    return '<datalist id="' + idLista + '">' + opciones.map(function (o) {
      return '<option value="' + UI.esc(o) + '"></option>';
    }).join('') + '</datalist>';
  }

  function fecha(op) {
    const cid = idDe(op);
    const control =
      '<div class="campo-caja">' +
        '<input class="campo-control" id="' + cid + '" type="date" ' +
          'value="' + UI.esc(op.valor || '') + '" ' +
          (op.max ? 'max="' + UI.esc(op.max) + '" ' : '') +
          (op.min ? 'min="' + UI.esc(op.min) + '" ' : '') +
          'data-tipo="fecha">' +
      '</div>';
    return envolver(cid, op.etiqueta, control, op.ayuda, op);
  }

  function entero(op) {
    const cid = idDe(op);
    const control =
      '<div class="campo-caja">' +
        '<input class="campo-control num" id="' + cid + '" inputmode="numeric" ' +
          'value="' + UI.esc(op.valor == null ? '' : op.valor) + '" ' +
          'placeholder="' + UI.esc(op.placeholder || '') + '" data-tipo="entero">' +
      '</div>';
    return envolver(cid, op.etiqueta, control, op.ayuda, op);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEGMENTADO E INTERRUPTOR
  // ═══════════════════════════════════════════════════════════════════════════

  /** Para 2-3 opciones excluyentes que caben en una línea. Todas visibles a la vez. */
  function segmentado(op) {
    const cid = idDe(op);
    const control = '<div class="segmentado" id="' + cid + '" role="radiogroup" ' +
      'data-tipo="segmentado" data-valor="' + UI.esc(op.valor || '') + '">' +
      op.opciones.map(function (o) {
        const sel = String(o.valor) === String(op.valor);
        return '<button type="button" class="segmento pulsable" role="radio" ' +
          'aria-checked="' + sel + '" data-valor="' + UI.esc(o.valor) + '">' +
          UI.esc(o.texto) + '</button>';
      }).join('') + '</div>';
    return envolver(cid, op.etiqueta, control, op.ayuda, op);
  }

  function interruptor(op) {
    const cid = idDe(op);
    const control = '<div class="campo-interruptor">' +
      '<span class="t-body crece">' + UI.esc(op.texto) + '</span>' +
      '<button type="button" class="interruptor pulsable" id="' + cid + '" ' +
        'role="switch" aria-checked="' + (op.valor === true) + '" ' +
        'data-tipo="interruptor"><span class="interruptor-bola"></span></button>' +
    '</div>';
    return '<div class="campo" data-campo="' + cid + '"' + (op.oculto ? ' hidden' : '') + '>' +
      control + (op.ayuda ? '<p class="campo-ayuda t-caption txt-2">' +
      UI.esc(op.ayuda) + '</p>' : '') + '<p class="campo-error t-caption"></p></div>';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECTOR — abre una hoja
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Un botón que abre una hoja de selección, no un `<select>` nativo. El nativo no puede
   * mostrar el ícono y el color de cada categoría, ni agrupar en dos niveles, ni traer los
   * cinco de acceso rápido del §9.4.
   */
  function selector(op) {
    const cid = idDe(op);
    const control =
      '<button type="button" class="campo-caja campo-selector pulsable" id="' + cid + '" ' +
        'data-tipo="selector" data-valor="' + UI.esc(op.valor || '') + '" ' +
        'data-abre="' + UI.esc(op.abre) + '">' +
        (op.icono
          ? '<span class="ico-cat ico-cat-sm" style="--color-cat:' + UI.esc(op.color || '#8D8D8D') +
            '">' + UI.ico(op.icono) + '</span>'
          : '') +
        '<span class="crece recorta campo-selector-texto' +
          (op.texto ? '' : ' txt-3') + '">' +
          UI.esc(op.texto || op.vacio || 'Elegir') + '</span>' +
        UI.ico('chevron-right') +
      '</button>';
    return envolver(cid, op.etiqueta, control, op.ayuda, op);
  }

  /** Refresca lo que muestra un selector tras elegir en su hoja. */
  function fijarSelector(el, valor, texto, icono, color) {
    el.dataset.valor = valor == null ? '' : String(valor);
    const t = el.querySelector('.campo-selector-texto');
    t.textContent = texto || 'Elegir';
    t.classList.toggle('txt-3', !texto);

    let ico = el.querySelector('.ico-cat');
    if (icono) {
      if (!ico) {
        el.insertAdjacentHTML('afterbegin',
          '<span class="ico-cat ico-cat-sm"></span>');
        ico = el.querySelector('.ico-cat');
      }
      ico.style.setProperty('--color-cat', color || '#8D8D8D');
      ico.innerHTML = UI.ico(icono);
    } else if (ico) {
      ico.remove();
    }
    limpiarError(el.closest('.campo'));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ERRORES (§9 reglas 2 y 3)
  // ═══════════════════════════════════════════════════════════════════════════

  function marcarError(campo, mensaje) {
    if (!campo) return;
    campo.dataset.error = 'true';
    const p = campo.querySelector('.campo-error');
    if (p) p.textContent = mensaje;
  }

  function limpiarError(campo) {
    if (!campo) return;
    delete campo.dataset.error;
    const p = campo.querySelector('.campo-error');
    if (p) p.textContent = '';
  }

  /**
   * Engancha el comportamiento común a un formulario ya pintado.
   * @param {HTMLElement} raiz
   * @param {Function} alCambiar  se llama en cada cambio para revalidar el botón
   */
  function conectar(raiz, alCambiar) {
    const avisar = alCambiar || function () {};

    raiz.addEventListener('input', function (e) {
      const el = e.target;
      if (el.dataset.tipo === 'monto') formatearMonto(el);
      if (el.dataset.tipo === 'entero') el.value = el.value.replace(/\D/g, '').slice(0, 3);
      // Regla 3: al escribir NO se valida, pero sí se limpia el error anterior. Dejarlo
      // puesto mientras la persona ya está corrigiendo es ruido.
      limpiarError(el.closest('.campo'));
      avisar();
    });

    // Regla 3: la validación ocurre al perder el foco.
    raiz.addEventListener('focusout', function (e) {
      const campo = e.target.closest('.campo');
      if (!campo || !campo._validar) return;
      const err = campo._validar();
      if (err) marcarError(campo, err); else limpiarError(campo);
      avisar();
    });

    raiz.addEventListener('click', function (e) {
      const seg = e.target.closest('.segmento');
      if (seg) {
        const grupo = seg.parentElement;
        grupo.dataset.valor = seg.dataset.valor;
        grupo.querySelectorAll('.segmento').forEach(function (b) {
          b.setAttribute('aria-checked', String(b === seg));
        });
        limpiarError(grupo.closest('.campo'));
        avisar();
        return;
      }
      const sw = e.target.closest('.interruptor');
      if (sw) {
        sw.setAttribute('aria-checked',
          sw.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
        avisar();
      }
    });

    // Regla 5: el monto recibe el foco al abrir. `preventScroll` evita que la vista salte
    // antes de que la animación de entrada termine.
    const foco = raiz.querySelector('[data-autofoco]');
    if (foco && !App.plataforma().escritorio) {
      setTimeout(function () { foco.focus({ preventScroll: true }); }, 320);
    } else if (foco) {
      foco.focus({ preventScroll: true });
    }
  }

  /** Valor de un campo por su id, sea cual sea su tipo. */
  function valor(raiz, campoId) {
    const el = raiz.querySelector('#' + campoId);
    if (!el) return null;
    const t = el.dataset.tipo;
    if (t === 'monto') return leerMonto(el);
    if (t === 'entero') return el.value ? parseInt(el.value, 10) : null;
    if (t === 'segmentado') return el.dataset.valor || null;
    if (t === 'selector') return el.dataset.valor || null;
    if (t === 'interruptor') return el.getAttribute('aria-checked') === 'true';
    return String(el.value || '').trim();
  }

  /** Registra la validación de un campo. Devuelve el mensaje de error, o '' si está bien. */
  function validarCon(raiz, campoId, fn) {
    const campo = raiz.querySelector('[data-campo="' + campoId + '"]');
    if (campo) campo._validar = fn;
  }

  return {
    id: id, envolver: envolver,
    monto: monto, texto: texto, fecha: fecha, entero: entero,
    segmentado: segmentado, interruptor: interruptor, selector: selector,
    fijarSelector: fijarSelector,
    marcarError: marcarError, limpiarError: limpiarError,
    conectar: conectar, valor: valor, validarCon: validarCon,
    leerMonto: leerMonto, formatearMonto: formatearMonto
  };
})();
