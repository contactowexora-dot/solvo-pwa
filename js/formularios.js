/**
 * SOLVO — Formularios de registro.
 * Manual 1 §9 (formularios) · §7 (arquitectura de movimientos) · Manual 2 §4.2 (las tres reglas)
 * Manual 3 §7.7, §11 (pantalla completa en móvil, botón fijo al pie).
 *
 * ══ LO QUE EL FORMULARIO NO DECIDE ═══════════════════════════════════════════════
 *
 * Las tres reglas que definen el producto viven en el servidor y aquí NO se replican:
 *
 *   · una cuota = una fila;
 *   · editar una cuota edita todas;
 *   · un gasto compartido se parte en filas, con el residuo del céntimo para el primer
 *     responsable por orden alfabético.
 *
 * El formulario recoge la intención y la manda. Calcular aquí el reparto para «enseñarlo
 * antes» sería tener la misma regla en dos sitios, y el día que difieran el usuario verá una
 * cifra en la pantalla de registro y otra distinta en su lista de movimientos.
 *
 * Lo que sí hace el formulario es **no dejar mandar algo que el servidor va a rechazar**:
 * validaciones de forma —hay monto, hay categoría, hay producto—, nunca de negocio.
 */
const Formularios = (function () {

  let catalogos = null;
  let abierto = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // CATÁLOGOS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Se piden una vez por sesión. Son categorías, responsables y productos: cambian poco y
   * pedirlos en cada apertura añadiría medio segundo a la acción más frecuente de la app.
   */
  async function cargarCatalogos(forzar) {
    if (catalogos && !forzar) return catalogos;
    catalogos = await Api.llamar('catalogos', {}, { clave: 'catalogos' });
    return catalogos;
  }

  function invalidarCatalogos() { catalogos = null; }

  function categoriasDe(grupo) {
    return (catalogos.categorias || []).filter(function (c) { return c.grupo === grupo; })
      .sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
  }

  function subcategoriasDe(idCategoria) {
    return (catalogos.subcategorias || [])
      .filter(function (s) { return s.id_categoria === idCategoria; })
      .sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
  }

  function buscarCategoria(id) {
    return (catalogos.categorias || []).filter(function (c) {
      return c.id_categoria === id; })[0] || null;
  }

  function buscarSub(id) {
    return (catalogos.subcategorias || []).filter(function (s) {
      return s.id_subcategoria === id; })[0] || null;
  }

  /** Cuentas y tarjetas en una sola lista, que es como el §9.2 campo 6 las pide. */
  function productos(soloCuentas) {
    const ctas = (catalogos.cuentas || []).map(function (c) {
      return { tipo: 'CUENTA', id: c.id_cuenta, nombre: c.nombre, banco: c.banco,
               moneda: c.moneda, numero_final: c.numero_final, color: c.color,
               icono: c.icono || 'wallet' };
    });
    if (soloCuentas) return ctas;
    return ctas.concat((catalogos.tarjetas || []).map(function (t) {
      return { tipo: 'TARJETA', id: t.id_tarjeta, nombre: t.nombre, banco: t.banco,
               moneda: t.moneda, numero_final: t.numero_final, color: t.color,
               icono: 'credit-card' };
    }));
  }

  function buscarProducto(clave) {
    const p = String(clave || '').split(':');
    return productos().filter(function (x) {
      return x.tipo === p[0] && x.id === p[1]; })[0] || null;
  }

  function responsablePrincipal() {
    const rs = catalogos.responsables || [];
    return rs.filter(function (r) { return r.es_principal === true; })[0] || rs[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CASCARÓN DEL FORMULARIO (§11: pantalla completa, botón fijo al pie)
  // ═══════════════════════════════════════════════════════════════════════════

  function abrirCascaron(op) {
    if (abierto) abierto.cerrar(true);

    const el = document.createElement('div');
    el.className = 'formulario';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', op.titulo);
    el.innerHTML =
      '<header class="formulario-cab">' +
        '<button type="button" class="btn-icono pulsable" data-al="cerrar" ' +
          'aria-label="Cerrar">' + UI.ico('x') + '</button>' +
        '<h2 class="crece t-title recorta">' + UI.esc(op.titulo) + '</h2>' +
      '</header>' +
      '<div class="formulario-cuerpo" data-cuerpo>' + op.html + '</div>' +
      // Regla 6: botón fijo al pie, deshabilitado hasta que el formulario sea válido.
      '<footer class="formulario-pie">' +
        '<button type="button" class="btn btn-primario btn-bloque pulsable" ' +
          'data-al="guardar" disabled>' + UI.esc(op.guardar || 'Guardar') + '</button>' +
      '</footer>';

    document.body.appendChild(el);
    const scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focoPrevio = document.activeElement;

    let sucio = false;
    let guardando = false;

    function cerrar(forzar) {
      if (abierto !== api) return;
      // Regla 7: cerrar con cambios sin guardar pide confirmación.
      if (sucio && !forzar && !guardando) {
        if (!confirm('Tienes cambios sin guardar. ¿Cerrar de todos modos?')) return;
      }
      abierto = null;
      document.body.style.overflow = scrollPrevio;
      document.removeEventListener('keydown', alTeclado);
      el.dataset.saliendo = 'true';
      setTimeout(function () { el.remove(); }, 200);
      if (focoPrevio && focoPrevio.isConnected) focoPrevio.focus();
    }

    function alTeclado(e) {
      if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
    }
    document.addEventListener('keydown', alTeclado);

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-al="cerrar"]')) return cerrar();
      if (e.target.closest('[data-al="guardar"]')) return api.guardar();
    });

    const api = {
      el: el,
      cuerpo: el.querySelector('[data-cuerpo]'),
      botón: el.querySelector('[data-al="guardar"]'),
      cerrar: cerrar,
      ensuciar: function () { sucio = true; },
      guardar: function () {},
      ocupado: function (v) {
        guardando = v;
        api.botón.disabled = v;
        api.botón.textContent = v ? 'Guardando…' : (op.guardar || 'Guardar');
      }
    };
    abierto = api;
    return api;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECTOR DE CATEGORÍA (§9.4)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Hoja con buscador, los cinco de acceso rápido y los dos niveles desplegables. Se puede
   * elegir una categoría principal sin bajar a subcategoría: obligar a elegir subcategoría
   * en cada gasto es la clase de fricción que hace que la gente deje de registrar.
   */
  function elegirCategoria(grupo, actual, alElegir) {
    const cats = categoriasDe(grupo);
    const frecuentes = cats.slice(0, 5);

    const hoja = UI.abrirHoja({
      titulo: 'Categoría',
      html:
        '<div class="campo-caja" style="margin-bottom:var(--sp-3)">' +
          UI.ico('search', 'ico-16') +
          '<input class="campo-control" type="search" placeholder="Buscar categoría" ' +
            'data-buscar autocomplete="off">' +
        '</div>' +
        '<div class="carril-chips" style="margin-bottom:var(--sp-3)" data-rapidos>' +
          frecuentes.map(function (c) {
            // `data-cat-rapida` y no `data-cat`: los botones de SUBcategoría también
            // llevan `data-cat`, y con el mismo nombre el primer closest() los capturaba
            // aquí y la subcategoría elegida se perdía en silencio.
            return '<button type="button" class="chip pulsable" data-cat-rapida="' +
              UI.esc(c.id_categoria) + '">' + UI.ico(c.icono) + UI.esc(c.nombre) + '</button>';
          }).join('') +
        '</div>' +
        '<ul class="lista-cat" data-lista>' + cats.map(filaCategoria).join('') + '</ul>',
      alAbrir: function (raiz) {
        raiz.addEventListener('input', function (e) {
          if (!e.target.matches('[data-buscar]')) return;
          const q = e.target.value.trim().toLowerCase();
          raiz.querySelector('[data-rapidos]').hidden = q.length > 0;
          raiz.querySelectorAll('[data-fila-cat]').forEach(function (li) {
            const cid = li.dataset.filaCat;
            const c = buscarCategoria(cid);
            const subs = subcategoriasDe(cid);
            const coincide = !q || c.nombre.toLowerCase().indexOf(q) >= 0 ||
              subs.some(function (s) { return s.nombre.toLowerCase().indexOf(q) >= 0; });
            li.hidden = !coincide;
            // Al buscar se despliegan solas: si no, un resultado que está dentro de una
            // categoría cerrada parece que no existe.
            if (q && coincide) li.dataset.abierta = 'true';
          });
        });

        raiz.addEventListener('click', function (e) {
          const chip = e.target.closest('[data-cat-rapida]');
          if (chip) { elegir(chip.dataset.catRapida, null); return; }

          const cab = e.target.closest('[data-abrir-cat]');
          if (cab) {
            const li = cab.closest('[data-fila-cat]');
            li.dataset.abierta = li.dataset.abierta === 'true' ? 'false' : 'true';
            return;
          }
          const sub = e.target.closest('[data-sub]');
          if (sub) { elegir(sub.dataset.cat, sub.dataset.sub); return; }

          const sola = e.target.closest('[data-solo-cat]');
          if (sola) { elegir(sola.dataset.soloCat, null); return; }
        });
      }
    });

    function elegir(idCat, idSub) {
      hoja.cerrar();
      alElegir(idCat, idSub);
    }
  }

  function filaCategoria(c) {
    const subs = subcategoriasDe(c.id_categoria);
    return '<li data-fila-cat="' + UI.esc(c.id_categoria) + '" data-abierta="false">' +
      '<div class="fila fila-cat">' +
        '<button type="button" class="fila crece pulsable" data-solo-cat="' +
          UI.esc(c.id_categoria) + '" style="text-align:left;min-height:52px">' +
          '<span class="ico-cat ico-cat-sm" style="--color-cat:' + UI.esc(c.color) + '">' +
            UI.ico(c.icono) + '</span>' +
          '<span class="crece t-card-title recorta">' + UI.esc(c.nombre) + '</span>' +
        '</button>' +
        (subs.length
          ? '<button type="button" class="btn-icono pulsable chevron-cat" ' +
            'data-abrir-cat aria-label="Ver subcategorías de ' + UI.esc(c.nombre) + '">' +
            UI.ico('chevron-down') + '</button>'
          : '') +
      '</div>' +
      (subs.length
        ? '<ul class="lista-sub">' + subs.map(function (s) {
            return '<li><button type="button" class="fila pulsable lista-sub-item" ' +
              'data-cat="' + UI.esc(c.id_categoria) + '" data-sub="' +
              UI.esc(s.id_subcategoria) + '">' +
              '<span class="t-body crece recorta">' + UI.esc(s.nombre) + '</span></button></li>';
          }).join('') + '</ul>'
        : '') +
    '</li>';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECTOR DE PRODUCTO Y DE RESPONSABLES
  // ═══════════════════════════════════════════════════════════════════════════

  function elegirProducto(soloCuentas, actual, alElegir) {
    const lista = productos(soloCuentas);
    if (!lista.length) {
      UI.avisar('Primero crea una cuenta o una tarjeta.', { error: true });
      return;
    }
    const hoja = UI.abrirHoja({
      titulo: soloCuentas ? 'Cuenta' : 'Cuenta o tarjeta',
      html: '<ul class="pila">' + lista.map(function (p) {
        const clave = p.tipo + ':' + p.id;
        return '<li><button type="button" class="fila pulsable fila-opcion" data-prod="' +
          UI.esc(clave) + '"' + (clave === actual ? ' aria-current="true"' : '') + '>' +
          '<span class="ico-cat ico-cat-sm" style="--color-cat:' +
            UI.esc(p.color || '#8D8D8D') + '">' + UI.ico(p.icono) + '</span>' +
          '<span class="crece pila" style="text-align:left">' +
            '<span class="t-card-title recorta">' + UI.esc(p.nombre) + '</span>' +
            '<span class="t-caption txt-2">' +
              UI.esc([p.banco, p.moneda, p.numero_final && '•••' + p.numero_final]
                     .filter(Boolean).join(' · ')) + '</span>' +
          '</span>' +
          (clave === actual ? UI.ico('check') : '') +
        '</button></li>';
      }).join('') + '</ul>',
      alAbrir: function (raiz) {
        raiz.addEventListener('click', function (e) {
          const b = e.target.closest('[data-prod]');
          if (!b) return;
          hoja.cerrar();
          alElegir(b.dataset.prod);
        });
      }
    });
  }

  /** Multiselección (§9.1 campo 4, §9.2 campo 9). Nunca se puede dejar en cero. */
  function elegirResponsables(actuales, alElegir) {
    const rs = catalogos.responsables || [];
    const sel = new Set(actuales || []);

    const hoja = UI.abrirHoja({
      titulo: 'Responsables',
      html: '<ul class="pila" data-lista>' + rs.map(function (r) {
        return '<li><button type="button" class="fila pulsable fila-opcion" data-resp="' +
          UI.esc(r.id_responsable) + '" aria-pressed="' + sel.has(r.id_responsable) + '">' +
          '<span class="ico-cat ico-cat-sm" style="--color-cat:' +
            UI.esc(r.color || '#8D8D8D') + '">' + UI.ico('user') + '</span>' +
          '<span class="crece t-card-title recorta" style="text-align:left">' +
            UI.esc(r.nombre) + (r.es_principal ? ' · tú' : '') + '</span>' +
          '<span class="marca-sel">' + UI.ico('check') + '</span>' +
        '</button></li>';
      }).join('') + '</ul>' +
      '<button type="button" class="btn btn-primario btn-bloque pulsable" ' +
        'style="margin-top:var(--sp-4)" data-confirmar>Listo</button>',
      alAbrir: function (raiz) {
        raiz.addEventListener('click', function (e) {
          const b = e.target.closest('[data-resp]');
          if (b) {
            const id = b.dataset.resp;
            if (sel.has(id)) sel.delete(id); else sel.add(id);
            b.setAttribute('aria-pressed', String(sel.has(id)));
            return;
          }
          if (e.target.closest('[data-confirmar]')) {
            if (!sel.size) return UI.avisar('Elige al menos un responsable.', { error: true });
            hoja.cerrar();
            alElegir(Array.from(sel));
          }
        });
      }
    });
  }

  function nombresResponsables(ids) {
    const rs = catalogos.responsables || [];
    return (ids || []).map(function (id) {
      const r = rs.filter(function (x) { return x.id_responsable === id; })[0];
      return r ? r.nombre : id;
    }).join(', ');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GUARDADO Y DESHACER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Tras guardar: snackbar con `Deshacer` durante 5 segundos (§9).
   *
   * Deshacer llama a `movimiento.eliminar` con el `id_operacion`, que borra **todas** las
   * filas de la operación: las doce cuotas, o las tres del gasto compartido. Deshacer una
   * cuota de doce dejaría un movimiento mutilado, y es justo lo que la regla «editar una
   * cuota edita todas» previene en el otro sentido.
   */
  function avisarGuardado(r, texto) {
    const avisos = (r.avisos || []).filter(Boolean);
    UI.avisar(texto, {
      ms: 5000,
      accion: {
        texto: 'Deshacer',
        al: async function () {
          try {
            await Api.llamar('movimiento.eliminar', { id_operacion: r.id_operacion });
            UI.avisar('Deshecho.');
            App.recargar();
          } catch (e) { UI.avisarError(e); }
        }
      }
    });
    // Los avisos del servidor —saldo insuficiente, fecha movida por feriado— van aparte y
    // después: son información, no un fallo, y no deben tapar la opción de deshacer.
    if (avisos.length) setTimeout(function () { UI.avisar(avisos[0]); }, 5400);
  }

  async function enviar(api, accion, cuerpo, textoOk) {
    api.ocupado(true);
    try {
      const r = await Api.llamar(accion, cuerpo);
      api.cerrar(true);
      avisarGuardado(r, textoOk);
      App.recargar();
    } catch (e) {
      api.ocupado(false);
      UI.avisarError(e);
    }
  }

  function hoyISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }

  return {
    cargarCatalogos: cargarCatalogos,
    invalidarCatalogos: invalidarCatalogos,
    abrirCascaron: abrirCascaron,
    elegirCategoria: elegirCategoria,
    elegirProducto: elegirProducto,
    elegirResponsables: elegirResponsables,
    nombresResponsables: nombresResponsables,
    buscarCategoria: buscarCategoria,
    buscarSub: buscarSub,
    buscarProducto: buscarProducto,
    productos: productos,
    categoriasDe: categoriasDe,
    responsablePrincipal: responsablePrincipal,
    enviar: enviar,
    hoyISO: hoyISO,
    catalogos: function () { return catalogos; }
  };
})();
