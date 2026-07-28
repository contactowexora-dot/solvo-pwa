/**
 * SOLVO — Administrar → Bancos: plantillas de correo enseñadas por ejemplo.
 * Manual 4 §C completo (reemplaza el Manual 2 §7). Manual 1 §8.8, §1 (nav).
 *
 * Sin esto, el importador automático de Gmail no reconoce NINGÚN correo — §C.2: la
 * búsqueda se arma con los remitentes que existen en `PLANTILLAS_CORREO`, y si esa
 * hoja está vacía, `GmailImport.procesar()` no ejecuta ninguna búsqueda. Esta pantalla
 * es literalmente la única forma de conectar «de qué correos sacamos datos».
 *
 * La persona **nunca escribe una expresión regular**: selecciona con el mouse el
 * fragmento de un correo de ejemplo y el servidor guarda el ancla (texto antes/después).
 * El motor que aplica esas anclas vive en `PlantillasCorreo.gs` — aquí solo se arma la
 * selección y se enseña al servidor, exactamente igual que hace la vista previa antes
 * de guardar (misma ruta, `plantilla.probar`, para que la vista previa nunca mienta).
 *
 * Reenseñar un formato ya guardado (cuando un banco cambia su correo) necesita el texto
 * ORIGINAL del correo de ejemplo, que `plantilla.listar` no devuelve — el Manual 4 §C.7
 * resuelve esto desde el Centro de Acciones, con el correo NUEVO que disparó el aviso,
 * no desde aquí. Por eso esta pantalla, hoy, solo crea formatos nuevos; sobre uno ya
 * guardado únicamente activa/desactiva o elimina.
 *
 * Todo el archivo vive en un IIFE por la misma razón que las demás pantallas.
 */
(function () {

const Banco = (function () {
  const est = { vista: null, datos: null };
  return { est: est };
})();

App.registrar('bancos', async function (vista) {
  vista.innerHTML = esqueleto();
  Banco.est.vista = vista;

  await Api.leer('plantilla.listar', {}, { clave: 'plantillas' }, function (d) {
    Banco.est.datos = d;
    pintar(vista);
    conectar(vista);
  });
}, 'Bancos');

// ═══════════════════════════════════════════════════════════════════════════════
// PINTADO — LISTA
// ═══════════════════════════════════════════════════════════════════════════════

function esqueleto() {
  return '<div class="pila pila-3">' + UI.huesosFilas(3) + '</div>';
}

function pintar(vista) {
  const d = Banco.est.datos;
  vista.innerHTML =
    filaAgregar() +
    (d.sin_plantillas ? avisoSinPlantillas() : '') +
    (d.ambiguas && d.ambiguas.length ? d.ambiguas.map(avisoAmbigua).join('') : '') +
    (d.plantillas.length ? listaPlantillas(d.plantillas) : pintarVacioInline());
}

function filaAgregar() {
  return '<div class="fila-entre" style="margin-bottom:var(--sp-4)">' +
    '<span class="t-overline txt-2">Bancos</span>' +
    '<button class="btn-icono pulsable" data-al="agregar" aria-label="Agregar formato">' +
      UI.ico('plus') + '</button>' +
  '</div>';
}

function avisoSinPlantillas() {
  return '<div class="tarjeta tarjeta-plana pila pila-1" style="margin-bottom:var(--sp-4)">' +
    '<p class="t-body txt-2">Sin ningún formato enseñado, el importador no lee ningún ' +
    'correo — más allá del permiso ya otorgado, la bandeja no se toca.</p>' +
  '</div>';
}

function avisoAmbigua(a) {
  return '<div class="tarjeta tarjeta-plana pila pila-1" style="margin-bottom:var(--sp-3)">' +
    '<p class="t-label" style="color:var(--warning-text)">' + UI.ico('triangle-alert', 'ico-14') +
    ' ' + UI.esc(a.remitente) + '</p>' +
    '<p class="t-caption txt-2">' + UI.esc(a.mensaje) + '</p>' +
  '</div>';
}

function pintarVacioInline() {
  return UI.vacio({
    icono: 'landmark',
    titulo: 'Enseña tu primer banco',
    texto: 'Pega un correo de notificación bancaria y el sistema aprende a reconocerlo.',
    cta: { texto: 'Agregar formato', accion: 'agregar' }
  });
}

const NOMBRE_TIPO = { GASTO: 'Gasto', INGRESO: 'Ingreso', SEGUN_CORREO: 'Según el correo' };

function listaPlantillas(items) {
  return '<div class="pila pila-3" data-lista>' + items.map(function (p) {
    return '<button class="tarjeta pulsable" style="width:100%;text-align:left" ' +
      'data-plantilla="' + UI.esc(p.id_plantilla) + '">' +
      '<div class="fila">' +
        '<span class="ico-cat" style="--color-cat:var(--cat-indigo)">' +
          UI.ico('landmark') + '</span>' +
        '<span class="crece pila" style="gap:2px">' +
          '<span class="t-card-title recorta">' + UI.esc(p.alias_banco) + '</span>' +
          '<span class="t-caption txt-2 recorta">' + UI.esc(p.remitente) + ' · ' +
            (NOMBRE_TIPO[p.tipo_movimiento] || p.tipo_movimiento) + '</span>' +
        '</span>' +
        (!p.activo
          ? '<span class="badge" style="background:var(--bg-inset);color:var(--text-secondary)">' +
            'Archivada</span>'
          : p.pendientes_generados > 0
            ? '<span class="t-caption txt-2">' + p.pendientes_generados + ' importados</span>'
            : '') +
      '</div>' +
    '</button>';
  }).join('') + '</div>';
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACCIÓN — LISTA
// ═══════════════════════════════════════════════════════════════════════════════

function conectar(vista) {
  if (vista._conectado) return;
  vista._conectado = true;

  vista.addEventListener('click', function (e) {
    if (e.target.closest('[data-accion="agregar"]') || e.target.closest('[data-al="agregar"]')) {
      return abrirAsistente();
    }
    const fila = e.target.closest('[data-plantilla]');
    if (fila) return abrirGestionPlantilla(fila.dataset.plantilla);
  });
}

function plantillaPorId(id) {
  return (Banco.est.datos.plantillas || []).filter(function (p) {
    return p.id_plantilla === id; })[0] || null;
}

function repintarActual() {
  if (!Banco.est.vista || !Banco.est.vista.isConnected) return;
  pintar(Banco.est.vista);
}

function refrescarSilencioso() {
  Api.leer('plantilla.listar', {}, { clave: 'plantillas' }, function (d) {
    Banco.est.datos = d;
    repintarActual();
  }).catch(function () {});
}

function abrirGestionPlantilla(id) {
  const p = plantillaPorId(id);
  if (!p) return;
  const hoja = UI.abrirHoja({
    titulo: p.alias_banco,
    html: '<p class="t-body txt-2" style="margin-bottom:var(--sp-5)">' +
        UI.esc(p.remitente) + '</p>' +
      '<div class="pila pila-2">' +
        '<button class="btn btn-secundario btn-bloque pulsable" data-toggle>' +
          (p.activo ? 'Desactivar' : 'Activar') + '</button>' +
        '<button class="btn btn-peligro btn-bloque pulsable" data-eliminar>Eliminar</button>' +
      '</div>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', async function (e) {
        if (e.target.closest('[data-toggle]')) {
          hoja.cerrar();
          try {
            await Api.llamar('plantilla.editar', { id_plantilla: p.id_plantilla, activo: !p.activo });
            UI.avisar(p.activo ? 'Formato desactivado' : 'Formato activado');
            refrescarSilencioso();
          } catch (err) { UI.avisarError(err); }
          return;
        }
        if (e.target.closest('[data-eliminar]')) {
          hoja.cerrar();
          eliminarPlantilla(p);
        }
      });
    }
  });
}

async function eliminarPlantilla(p) {
  let info;
  try {
    info = await Api.llamar('plantilla.eliminar', { id_plantilla: p.id_plantilla });
  } catch (e) { return UI.avisarError(e); }

  const esArchivar = info.accion === 'ARCHIVAR';
  const hoja = UI.abrirHoja({
    titulo: (esArchivar ? 'Archivar' : 'Eliminar') + ' «' + p.alias_banco + '»',
    html: '<p class="t-body txt-2" style="margin-bottom:var(--sp-5)">' + UI.esc(info.mensaje) +
      '</p><div class="pila pila-2">' +
      '<button class="btn btn-peligro btn-bloque pulsable" data-si>' +
        (esArchivar ? 'Archivar' : 'Eliminar') + '</button>' +
      '<button class="btn btn-secundario btn-bloque pulsable" data-no>Cancelar</button></div>',
    alAbrir: function (raiz) {
      raiz.addEventListener('click', async function (e) {
        if (e.target.closest('[data-no]')) { hoja.cerrar(); return; }
        if (!e.target.closest('[data-si]')) return;
        hoja.cerrar();
        try {
          await Api.llamar('plantilla.eliminar', { id_plantilla: p.id_plantilla, confirmar: true });
          UI.avisar(esArchivar ? 'Formato archivado' : 'Formato eliminado');
          refrescarSilencioso();
        } catch (err) { UI.avisarError(err); }
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NORMALIZACIÓN — debe coincidir EXACTO con `PlantillasCorreo.gs` normalizarTexto_:
// las marcas se capturan como offsets sobre este texto, y el servidor construye el
// ancla sobre el mismo texto normalizado. Si los dos difirieran, un offset de aquí
// apuntaría a otro carácter allá.
// ═══════════════════════════════════════════════════════════════════════════════

function normalizarTextoCorreo(t) {
  return String(t == null ? '' : t)
    .replace(/ /g, ' ')
    .replace(/​/g, '')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mejor esfuerzo sobre un `.eml` crudo (cabeceras MIME + cuerpo, posiblemente
 * multipart y en quoted-printable). No es un parser MIME completo — cuando el
 * resultado se ve mal, el asistente deja pegar el texto a mano encima.
 */
function extraerTextoDeEml(crudo) {
  const partes = String(crudo || '').split(/\r?\n\r?\n/);
  if (partes.length < 2) return normalizarTextoCorreo(crudo);

  const cabeceras = partes[0];
  let cuerpo = partes.slice(1).join('\n\n');

  const mBoundary = cabeceras.match(/boundary="?([^";\r\n]+)"?/i);
  if (mBoundary) {
    const limite = mBoundary[1];
    const trozos = cuerpo.split('--' + limite).filter(function (t) { return t.trim(); });
    const textoPlano = trozos.filter(function (t) { return /Content-Type:\s*text\/plain/i.test(t); })[0];
    const textoHtml = trozos.filter(function (t) { return /Content-Type:\s*text\/html/i.test(t); })[0];
    const elegido = textoPlano || textoHtml;
    if (elegido) {
      const sinCabecera = elegido.split(/\r?\n\r?\n/).slice(1).join('\n\n') || elegido;
      cuerpo = /Content-Transfer-Encoding:\s*quoted-printable/i.test(elegido)
        ? decodificarQuotedPrintable_(sinCabecera) : sinCabecera;
      if (textoHtml && elegido === textoHtml) cuerpo = quitarHtml_(cuerpo);
    }
  } else if (/Content-Type:\s*text\/html/i.test(cabeceras)) {
    cuerpo = quitarHtml_(cuerpo);
  }
  return normalizarTextoCorreo(cuerpo);
}

function decodificarQuotedPrintable_(s) {
  return String(s)
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
}

function quitarHtml_(s) {
  return String(s)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EL ASISTENTE — 4 pasos (§C.4)
// ═══════════════════════════════════════════════════════════════════════════════

const CAMPOS_POR_TIPO = {
  GASTO: [['fecha', 'Fecha'], ['comercio', 'Comercio'], ['importe', 'Importe'],
          ['moneda', 'Moneda'], ['ultimos4', 'Últimos 4 dígitos']],
  INGRESO: [['fecha', 'Fecha'], ['comercio', 'Comercio / concepto'], ['importe', 'Importe'],
            ['moneda', 'Moneda']],
  SEGUN_CORREO: [['fecha', 'Fecha'], ['comercio', 'Comercio / concepto'], ['importe', 'Importe'],
                 ['moneda', 'Moneda'], ['ultimos4', 'Últimos 4 dígitos (si trae)'],
                 ['discriminador', 'Palabra que decide']]
};
const OBLIGATORIOS = { fecha: true, comercio: true, importe: true };

function abrirAsistente() {
  const el = document.createElement('div');
  el.className = 'formulario';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Nuevo formato de correo');
  document.body.appendChild(el);
  const scrollPrevio = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const focoPrevio = document.activeElement;

  const est = {
    paso: 0,
    tipo: 'GASTO',
    alias_banco: '', remitente: '', texto_identificador: '',
    correo_ejemplo: '', marcas: {}, campoArmado: null,
    valor_discriminador_gasto: '', id_cuenta_destino: '', cuentaNombre: '',
    previa: null, guardando: false
  };

  function cerrar() {
    document.body.style.overflow = scrollPrevio;
    el.dataset.saliendo = 'true';
    setTimeout(function () { el.remove(); }, 200);
    if (focoPrevio && focoPrevio.isConnected) focoPrevio.focus();
  }

  function tituloPaso() {
    return ['Tipo de movimiento', 'Correo de ejemplo', 'Marcar los campos', 'Vista previa'][est.paso];
  }

  /**
   * Conserva foco y cursor a través de `render()`. `el.innerHTML = ...` destruye y
   * vuelve a crear TODOS los campos: sin esto, cualquier repintado durante el paso 1 o
   * 2 —cambiar de tipo, marcar un campo, o el que dispare `render()` de nuevo— saca a
   * la persona del campo en el que estaba escribiendo.
   */
  function render() {
    const activo = document.activeElement;
    const idActivo = (activo && el.contains(activo) && activo.id) || null;
    const seleccion = (idActivo && typeof activo.selectionStart === 'number')
      ? { inicio: activo.selectionStart, fin: activo.selectionEnd } : null;

    el.innerHTML =
      '<header class="formulario-cab">' +
        '<button type="button" class="btn-icono pulsable" data-al="cerrar" aria-label="Cerrar">' +
          UI.ico('x') + '</button>' +
        '<h2 class="crece t-title recorta">' + tituloPaso() + '</h2>' +
        '<span class="t-caption txt-2">' + (est.paso + 1) + '/4</span>' +
      '</header>' +
      '<div class="formulario-cuerpo" data-cuerpo>' + cuerpoPaso() + '</div>' +
      '<footer class="formulario-pie"><div class="fila" style="gap:var(--sp-3)">' +
        (est.paso > 0
          ? '<button class="btn btn-secundario pulsable" style="flex:1;max-width:none" ' +
            'data-atras>Atrás</button>'
          : '') +
        '<button class="btn btn-primario pulsable" style="flex:1;max-width:none" ' +
          'data-siguiente' + (avanzarDeshabilitado() ? ' disabled' : '') + '>' +
          (est.paso === 3 ? (est.guardando ? 'Guardando…' : 'Guardar') : 'Siguiente') +
        '</button>' +
      '</div></footer>';
    conectarPaso();

    if (idActivo) {
      const nuevo = el.querySelector('#' + idActivo);
      if (nuevo) {
        nuevo.focus({ preventScroll: true });
        if (seleccion && typeof nuevo.setSelectionRange === 'function') {
          nuevo.setSelectionRange(seleccion.inicio, seleccion.fin);
        }
      }
    }
  }

  function avanzarDeshabilitado() {
    if (est.paso === 0) return false;
    if (est.paso === 1) return normalizarTextoCorreo(est.correo_ejemplo).length <= 20 ||
      !est.alias_banco || !est.remitente;
    if (est.paso === 2) return !camposCompletos();
    if (est.paso === 3) return est.guardando || !(est.previa && est.previa.reconocido);
    return false;
  }

  function camposCompletos() {
    const campos = CAMPOS_POR_TIPO[est.tipo];
    for (let i = 0; i < campos.length; i++) {
      const clave = campos[i][0];
      if (OBLIGATORIOS[clave] && !est.marcas[clave]) return false;
    }
    if (est.tipo === 'GASTO' && !est.marcas.ultimos4) return false;
    if (est.tipo === 'INGRESO' && !est.id_cuenta_destino) return false;
    if (est.tipo === 'SEGUN_CORREO' &&
      (!est.marcas.discriminador || !est.valor_discriminador_gasto)) return false;
    return true;
  }

  // ── Paso 0 ──────────────────────────────────────────────────────────────────
  function cuerpoPaso() {
    if (est.paso === 0) return cuerpoPaso0();
    if (est.paso === 1) return cuerpoPaso1();
    if (est.paso === 2) return cuerpoPaso2();
    return cuerpoPaso3();
  }

  function cuerpoPaso0() {
    return '<p class="t-body txt-2">¿Qué tipo de movimiento trae este correo?</p>' +
      '<div class="pila pila-2">' +
        opcionTipo('GASTO', 'arrow-up-right', 'Gasto', 'Consumos con tarjeta.') +
        opcionTipo('INGRESO', 'arrow-down-left', 'Ingreso', 'Abonos, transferencias recibidas.') +
        opcionTipo('SEGUN_CORREO', 'arrow-left-right', 'Según el correo',
          'El mismo remitente manda cargos y abonos.') +
      '</div>';
  }
  function opcionTipo(valor, icono, texto, desc) {
    return '<button type="button" class="fila pulsable fila-opcion" data-tipo="' + valor + '" ' +
      'aria-current="' + (est.tipo === valor) + '">' +
      '<span class="ico-cat" style="--color-cat:var(--cat-indigo)">' + UI.ico(icono) + '</span>' +
      '<span class="crece pila" style="text-align:left;gap:2px">' +
        '<span class="t-card-title">' + texto + '</span>' +
        '<span class="t-caption txt-2">' + desc + '</span>' +
      '</span>' +
      (est.tipo === valor ? UI.ico('circle-check') : '') +
    '</button>';
  }

  // ── Paso 1 ──────────────────────────────────────────────────────────────────
  function cuerpoPaso1() {
    return Campos.texto({ id: 'alias', etiqueta: 'Nombre del banco', valor: est.alias_banco,
      autofoco: true, ayuda: 'Por ejemplo «BBVA» o «Interbank».' }) +
      Campos.texto({ id: 'remitente', etiqueta: 'Remitente del correo', valor: est.remitente,
        ayuda: 'La dirección que envía la notificación, p. ej. notificaciones@bbva.pe' }) +
      Campos.texto({ id: 'identificador', etiqueta: 'Texto identificador', opcional: true,
        valor: est.texto_identificador,
        ayuda: 'Algo del asunto o cuerpo que distinga este formato de otros del mismo banco.' }) +
      '<div class="campo">' +
        '<label class="campo-etiqueta t-label">Correo de ejemplo</label>' +
        '<div class="fila" style="gap:var(--sp-3);margin-bottom:var(--sp-2)">' +
          '<button type="button" class="btn btn-secundario pulsable" data-subir-eml>' +
            UI.ico('paperclip', 'ico-16') + 'Subir .eml</button>' +
          '<input type="file" accept=".eml,message/rfc822" data-input-eml hidden>' +
        '</div>' +
        '<textarea class="campo-control" data-correo-textarea rows="8" ' +
          'placeholder="Pega aquí el correo completo, tal como llegó">' +
          UI.esc(est.correo_ejemplo) + '</textarea>' +
        '<p class="campo-ayuda t-caption txt-2">Pégalo tal cual — el texto exacto es lo que se ' +
          'usa para marcar los campos en el siguiente paso.</p>' +
      '</div>';
  }

  // ── Paso 2 ──────────────────────────────────────────────────────────────────
  function cuerpoPaso2() {
    const texto = normalizarTextoCorreo(est.correo_ejemplo);
    const campos = CAMPOS_POR_TIPO[est.tipo];
    return '<p class="t-body txt-2">Selecciona con el mouse el fragmento del correo y toca el ' +
        'campo que corresponde. El sistema aprende el resto solo.</p>' +
      '<div class="tarjeta tarjeta-plana" style="max-height:220px;overflow:auto">' +
        '<pre data-correo style="white-space:pre-wrap;word-break:break-word;margin:0;' +
          'font:400 13px/1.6 var(--f-mono, monospace)">' + UI.esc(texto) + '</pre>' +
      '</div>' +
      '<div class="fila" style="flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-4)">' +
        campos.map(function (c) { return chipCampo(c[0], c[1]); }).join('') +
      '</div>' +
      (est.tipo === 'INGRESO'
        ? Campos.selector({ id: 'cuentaDestino', etiqueta: 'Cuenta destino', abre: 'cuenta',
            vacio: 'Elegir cuenta', texto: est.cuentaNombre,
            ayuda: 'Un abono no trae ningún número que lo identifique.' })
        : '') +
      (est.tipo === 'SEGUN_CORREO'
        ? Campos.texto({ id: 'valorDiscriminador', etiqueta: 'Valor que significa GASTO',
            valor: est.valor_discriminador_gasto,
            ayuda: 'Ej. si la palabra marcada dice «Cargo» o «Abono», escribe «Cargo».' })
        : '');
  }

  function chipCampo(clave, etiqueta) {
    const marca = est.marcas[clave];
    const armado = est.campoArmado === clave;
    return '<button type="button" class="chip pulsable" data-campo="' + clave + '" ' +
      'aria-pressed="' + armado + '" aria-current="' + !!marca + '">' +
      (marca ? UI.ico('check', 'ico-14') : '') + ' ' + etiqueta +
      (marca ? ': «' + UI.esc(marca.texto.slice(0, 18)) +
               (marca.texto.length > 18 ? '…' : '') + '»' : '') +
    '</button>';
  }

  // ── Paso 3 ──────────────────────────────────────────────────────────────────
  function cuerpoPaso3() {
    if (!est.previa) return '<div class="hueso" style="height:120px"></div>';
    const p = est.previa;
    return '<div class="tarjeta tarjeta-plana pila pila-1">' +
        p.resumen.split('\n').map(function (linea) {
          return '<p class="t-body">' + UI.esc(linea) + '</p>';
        }).join('') +
      '</div>' +
      (!p.reconocido
        ? '<p class="t-caption" style="color:var(--negative-text)">Falta reconocer: ' +
          UI.esc(p.faltantes.join(', ')) + '. Vuelve al paso anterior y ajusta esa marca.</p>'
        : '<p class="t-caption txt-2">Si se ve bien, guarda — el próximo ciclo del importador ' +
          'ya usa este formato.</p>');
  }

  // ── Interacción por paso ──────────────────────────────────────────────────
  /**
   * `el` (el contenedor `.formulario`) es el mismo nodo durante todo el asistente —
   * solo su `innerHTML` se reconstruye en cada `render()`. El clic delegado se
   * engancha UNA sola vez sobre `el`; los `{once: true}` habrían apagado el
   * asistente entero después del primer toque.
   */
  function conectarClicUnaVez() {
    if (el._clicConectado) return;
    el._clicConectado = true;

    el.addEventListener('click', async function (e) {
      if (e.target.closest('[data-al="cerrar"]')) { cerrar(); return; }

      if (e.target.closest('[data-atras]')) { est.paso--; render(); return; }

      const btnSiguiente = e.target.closest('[data-siguiente]');
      if (btnSiguiente) {
        // Al pasar a la vista previa se espera la respuesta de `plantilla.probar` ANTES
        // de repintar — mientras tanto la pantalla se queda con el paso anterior en
        // pantalla, botón incluido. Sin desactivarlo aquí mismo, un segundo toque
        // durante esa espera vuelve a entrar a este manejador con `est.paso` ya
        // avanzado, y lo que el usuario ve como «un segundo clic» termina disparando
        // el paso SIGUIENTE al que cree estar confirmando.
        if (btnSiguiente.disabled) return;

        if (est.paso === 1) leerCamposPaso1();
        if (est.paso === 3) { await guardar(); return; }
        est.paso++;
        if (est.paso === 3) {
          btnSiguiente.disabled = true;
          btnSiguiente.textContent = 'Cargando…';
          await cargarVistaPrevia();
          render();
          return;
        }
        render();
        return;
      }

      const tipoBtn = e.target.closest('[data-tipo]');
      if (tipoBtn) { est.tipo = tipoBtn.dataset.tipo; est.marcas = {}; render(); return; }

      if (e.target.closest('[data-subir-eml]')) {
        el.querySelector('[data-input-eml]').click();
        return;
      }

      const chip = e.target.closest('[data-campo]');
      if (chip) {
        est.campoArmado = est.campoArmado === chip.dataset.campo ? null : chip.dataset.campo;
        render();
        return;
      }

      const sel = e.target.closest('[data-abre="cuenta"]');
      if (sel) {
        Formularios.elegirProducto(true, est.id_cuenta_destino, function (clave) {
          const p = Formularios.buscarProducto(clave);
          est.id_cuenta_destino = clave.split(':')[1];
          est.cuentaNombre = p.nombre;
          render();
        });
      }
    });
  }

  function conectarPaso() {
    conectarClicUnaVez();
    const cuerpo = el.querySelector('[data-cuerpo]');

    if (el.querySelector('[data-input-eml]')) {
      el.querySelector('[data-input-eml]').addEventListener('change', function (e) {
        const archivo = e.target.files && e.target.files[0];
        if (!archivo) return;
        const lector = new FileReader();
        lector.onload = function () {
          est.correo_ejemplo = extraerTextoDeEml(String(lector.result));
          render();
        };
        lector.readAsText(archivo);
      });
    }

    const ta = el.querySelector('[data-correo-textarea]');
    if (ta) ta.addEventListener('input', function () {
      est.correo_ejemplo = ta.value;
      actualizarSiguienteHabilitado();
    });

    const contenedor = cuerpo && cuerpo.querySelector('[data-correo]');
    if (contenedor) {
      contenedor.addEventListener('mouseup', capturarMarca);
      contenedor.addEventListener('touchend', capturarMarca);
    }

    ['alias', 'remitente', 'identificador', 'valorDiscriminador'].forEach(function (id) {
      const input = el.querySelector('#' + id);
      if (!input) return;
      input.addEventListener('input', function () {
        if (id === 'alias') est.alias_banco = input.value;
        if (id === 'remitente') est.remitente = input.value;
        if (id === 'identificador') est.texto_identificador = input.value;
        if (id === 'valorDiscriminador') est.valor_discriminador_gasto = input.value;
        actualizarSiguienteHabilitado();
      });
    });
  }

  /** Re-evalúa solo el botón «Siguiente», sin rehacer todo el DOM — perder el foco del
   *  campo de texto en cada tecla sería peor que un botón que tarda un instante en
   *  habilitarse. */
  function actualizarSiguienteHabilitado() {
    const btn = el.querySelector('[data-siguiente]');
    if (btn) btn.disabled = avanzarDeshabilitado();
  }

  function leerCamposPaso1() {
    const alias = el.querySelector('#alias'); if (alias) est.alias_banco = alias.value;
    const rem = el.querySelector('#remitente'); if (rem) est.remitente = rem.value;
    const idf = el.querySelector('#identificador'); if (idf) est.texto_identificador = idf.value;
  }

  function capturarMarca() {
    if (!est.campoArmado) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const contenedor = el.querySelector('[data-correo]');
    if (!contenedor || range.startContainer !== contenedor.firstChild ||
        range.endContainer !== contenedor.firstChild) {
      return UI.avisar('Selecciona el texto directamente sobre el correo.', { error: true });
    }
    const texto = normalizarTextoCorreo(est.correo_ejemplo);
    est.marcas[est.campoArmado] = { inicio: range.startOffset, fin: range.endOffset,
      texto: texto.slice(range.startOffset, range.endOffset) };
    est.campoArmado = null;
    sel.removeAllRanges();
    render();
  }

  async function cargarVistaPrevia() {
    est.previa = null;
    try {
      est.previa = await Api.llamar('plantilla.probar', cuerpoParaApi());
    } catch (e) {
      est.previa = { reconocido: false, faltantes: [], resumen: 'No pude probar el formato: ' +
        e.message };
    }
  }

  function cuerpoParaApi() {
    const marcas = {};
    Object.keys(est.marcas).forEach(function (c) {
      marcas[c] = { inicio: est.marcas[c].inicio, fin: est.marcas[c].fin };
    });
    return {
      tipo_movimiento: est.tipo,
      correo_ejemplo: est.correo_ejemplo,
      marcas: marcas,
      valor_discriminador_gasto: est.valor_discriminador_gasto,
      id_cuenta_destino: est.id_cuenta_destino
    };
  }

  async function guardar() {
    est.guardando = true; render();
    try {
      const r = await Api.llamar('plantilla.crear', Object.assign(cuerpoParaApi(), {
        alias_banco: est.alias_banco, remitente: est.remitente,
        texto_identificador: est.texto_identificador
      }));
      cerrar();
      UI.avisar('Formato de «' + r.alias_banco + '» guardado');
      if ((r.avisos || []).length) setTimeout(function () { UI.avisar(r.avisos[0]); }, 400);
      refrescarSilencioso();
    } catch (e) {
      est.guardando = false; render();
      UI.avisarError(e);
    }
  }

  render();
}

})();
