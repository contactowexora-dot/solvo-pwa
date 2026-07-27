/**
 * SOLVO — Primitivas de interfaz.
 * Manual 3 §7.8 (bottom sheet) · §7.12 (snackbar) · §7.14 (skeleton) · §10.5 (detalles).
 */
const UI = (function () {

  // ── Plantillas ────────────────────────────────────────────────────────────

  /** Escapa para interpolar en HTML. Todo lo que venga del servidor pasa por aquí. */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** `<svg class="ico"><use href="#i-wallet"/></svg>` — Manual 3 §6.2. */
  function ico(nombre, clase) {
    return '<svg class="ico ' + (clase || '') + '" aria-hidden="true">' +
           '<use href="#i-' + esc(nombre) + '"/></svg>';
  }

  // ── Formato de dinero (§3.3) ──────────────────────────────────────────────

  const SIMBOLOS = { PEN: 'S/', USD: 'US$', EUR: '€' };

  /**
   * El signo va PEGADO al número y siempre presente: `+ S/ 1,200.00` / `− S/ 340.00`.
   * El signo, no el color, es lo que comunica la dirección — un daltónico ve el signo.
   * Se usa el menos tipográfico «−» (U+2212), no el guion: alinea con las cifras.
   */
  function monto(valor, moneda, opciones) {
    const op = opciones || {};
    const n = Number(valor) || 0;
    const simbolo = SIMBOLOS[String(moneda || window.SOLVO_CONFIG.MONEDA_BASE).toUpperCase()]
                    || String(moneda || '');
    const abs = Math.abs(n).toLocaleString('es-PE', {
      minimumFractionDigits: op.sinDecimales ? 0 : 2,
      maximumFractionDigits: op.sinDecimales ? 0 : 2
    });
    if (op.sinSigno) return simbolo + ' ' + abs;
    return (n < 0 ? '− ' : '+ ') + simbolo + ' ' + abs;
  }

  /** Píldora de variación (§7.5). El elemento memorable del §1.3. */
  function pildoraVariacion(pct, opciones) {
    const op = opciones || {};
    if (pct == null || !isFinite(pct)) {
      return '<span class="pildora pildora-neutra">—</span>';
    }
    const n = Number(pct);
    // «Menos gasto» es bueno y «menos ingreso» es malo: quién llama decide el sentido.
    const bueno = op.invertir ? n <= 0 : n >= 0;
    const clase = Math.abs(n) < 0.05 ? 'pildora-neutra' : (bueno ? 'pildora-pos' : 'pildora-neg');
    const flecha = Math.abs(n) < 0.05 ? '' : ico(n >= 0 ? 'arrow-up-right' : 'arrow-down-left');
    return '<span class="pildora ' + clase + '">' + flecha +
           Math.abs(n).toFixed(1).replace('.0', '') + '%</span>';
  }

  // ── Snackbar (§7.12, §10.5) ───────────────────────────────────────────────

  let zonaSnack = null;

  function zona() {
    if (!zonaSnack) {
      zonaSnack = document.createElement('div');
      zonaSnack.className = 'snackbar-zona';
      zonaSnack.setAttribute('role', 'status');
      zonaSnack.setAttribute('aria-live', 'polite');
      document.body.appendChild(zonaSnack);
    }
    return zonaSnack;
  }

  /**
   * @param {string} texto
   * @param {{error?: boolean, ms?: number, accion?: {texto: string, al: Function}}} [op]
   */
  function avisar(texto, op) {
    op = op || {};
    const el = document.createElement('div');
    el.className = 'snackbar' + (op.error ? ' snackbar-error' : '');
    el.innerHTML = ico(op.error ? 'circle-x' : 'circle-check') +
                   '<span class="crece">' + esc(texto) + '</span>';

    if (op.accion) {
      const b = document.createElement('button');
      b.className = 'snackbar-accion pulsable';
      b.textContent = op.accion.texto;
      b.addEventListener('click', function () { cerrar(); op.accion.al(); });
      el.appendChild(b);
    }
    zona().appendChild(el);

    // §10.5: el temporizador se pausa cuando la pestaña pierde visibilidad. Si no, un aviso
    // con «Deshacer» desaparece mientras el usuario está en otra pestaña y pierde la opción.
    const total = op.ms || (op.accion ? 6000 : 3400);
    let restante = total;
    let desde = Date.now();
    let temporizador = null;

    function arrancar() { desde = Date.now(); temporizador = setTimeout(cerrar, restante); }
    function pausar() {
      clearTimeout(temporizador);
      restante -= Date.now() - desde;
    }
    function alCambiarVisibilidad() {
      if (document.visibilityState === 'visible') arrancar(); else pausar();
    }
    function cerrar() {
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      if (!el.isConnected) return;
      el.dataset.saliendo = 'true';
      setTimeout(function () { el.remove(); }, 200);
    }

    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    arrancar();
    return cerrar;
  }

  function avisarError(e) {
    const msg = (e && e.message) || String(e);
    if (e && e.cancelada) return function () {};
    return avisar(msg, { error: true, ms: 5000 });
  }

  // ── Bottom sheet (§7.8) ───────────────────────────────────────────────────

  let hojaAbierta = null;

  /**
   * @param {{titulo?: string, html: string, alAbrir?: Function}} op
   * @return {{cerrar: Function, el: HTMLElement}}
   */
  function abrirHoja(op) {
    if (hojaAbierta) hojaAbierta.cerrar();

    const velo = document.createElement('div');
    velo.className = 'velo';

    const hoja = document.createElement('div');
    hoja.className = 'hoja';
    hoja.setAttribute('role', 'dialog');
    hoja.setAttribute('aria-modal', 'true');
    hoja.innerHTML =
      '<div class="hoja-asa"></div>' +
      (op.titulo ? '<h2 class="t-title" style="margin-bottom:var(--sp-4)">' +
                   esc(op.titulo) + '</h2>' : '') +
      op.html;

    document.body.appendChild(velo);
    document.body.appendChild(hoja);
    // Sin esto el fondo sigue haciendo scroll detrás de la hoja y se siente roto.
    const scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function cerrar() {
      if (hojaAbierta !== api) return;
      hojaAbierta = null;
      document.body.style.overflow = scrollPrevio;
      document.removeEventListener('keydown', alTeclado);
      velo.dataset.saliendo = 'true';
      hoja.dataset.saliendo = 'true';
      setTimeout(function () { velo.remove(); hoja.remove(); }, 200);
      if (foco && foco.isConnected) foco.focus();
    }

    function alTeclado(e) {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
    }

    const foco = document.activeElement;
    velo.addEventListener('click', cerrar);
    document.addEventListener('keydown', alTeclado);

    const api = { cerrar: cerrar, el: hoja };
    hojaAbierta = api;

    // El foco entra en la hoja: si no, tabular sigue recorriendo la pantalla de detrás.
    const primero = hoja.querySelector('button, [href], input, select, textarea, [tabindex]');
    if (primero) primero.focus({ preventScroll: true });
    else hoja.setAttribute('tabindex', '-1'), hoja.focus({ preventScroll: true });

    if (op.alAbrir) op.alAbrir(hoja);
    return api;
  }

  // ── Skeletons (§7.14) ─────────────────────────────────────────────────────

  /** Con la forma REAL del contenido. Un rectángulo genérico no prepara la vista. */
  function huesosFilas(n) {
    let h = '';
    for (let i = 0; i < (n || 4); i++) {
      h += '<div class="fila" style="min-height:56px">' +
             '<div class="hueso hueso-circulo"></div>' +
             '<div class="crece pila pila-2">' +
               '<div class="hueso hueso-linea" style="width:' + (52 + (i % 3) * 12) + '%"></div>' +
               '<div class="hueso hueso-linea" style="width:32%;height:11px"></div>' +
             '</div>' +
             '<div class="hueso hueso-linea" style="width:72px"></div>' +
           '</div>';
    }
    return h;
  }

  function huesoHero() {
    return '<div class="tarjeta pila pila-3">' +
             '<div class="hueso hueso-linea" style="width:40%;height:11px"></div>' +
             '<div class="hueso hueso-cifra"></div>' +
             '<div class="hueso hueso-linea" style="width:28%;height:24px;border-radius:999px"></div>' +
           '</div>';
  }

  // ── Estado vacío (§7.15) ──────────────────────────────────────────────────

  /** Título afirmativo y CTA. Nunca «no hay datos». */
  function vacio(op) {
    return '<div class="vacio">' +
             '<div class="vacio-ico">' + ico(op.icono || 'sparkles', 'ico-24') + '</div>' +
             '<h3 class="t-card-title">' + esc(op.titulo) + '</h3>' +
             (op.texto ? '<p class="t-body txt-2">' + esc(op.texto) + '</p>' : '') +
             (op.cta ? '<button class="btn btn-primario pulsable" data-accion="' +
                       esc(op.cta.accion) + '">' + esc(op.cta.texto) + '</button>' : '') +
           '</div>';
  }

  // ── Contador de cifra (§10.2, §10.5) ──────────────────────────────────────

  /**
   * §10.5: durante la animación se muestran enteros y solo el fotograma final lleva los dos
   * decimales. Los decimales girando son ruido, no información.
   */
  function animarCifra(el, hasta, moneda, ms) {
    const desde = Number(el.dataset.valor || 0);
    const fin = Number(hasta) || 0;
    el.dataset.valor = String(fin);

    if (matchMedia('(prefers-reduced-motion: reduce)').matches || desde === fin) {
      el.textContent = monto(fin, moneda, { sinSigno: true });
      return;
    }

    const dur = ms || 300;
    const t0 = performance.now();
    function paso(t) {
      const p = Math.min(1, (t - t0) / dur);
      // La misma curva que --ease-out, para que la cifra y el resto se sientan iguales.
      const e = 1 - Math.pow(1 - p, 3);
      if (p < 1) {
        el.textContent = monto(Math.round(desde + (fin - desde) * e), moneda,
                               { sinSigno: true, sinDecimales: true });
        requestAnimationFrame(paso);
      } else {
        el.textContent = monto(fin, moneda, { sinSigno: true });
      }
    }
    requestAnimationFrame(paso);
  }

  return {
    esc: esc, ico: ico, monto: monto, pildoraVariacion: pildoraVariacion,
    avisar: avisar, avisarError: avisarError,
    abrirHoja: abrirHoja,
    huesosFilas: huesosFilas, huesoHero: huesoHero,
    vacio: vacio, animarCifra: animarCifra
  };
})();
