/**
 * SOLVO — Configuración pública del cliente.
 *
 * Estos DOS valores son públicos por diseño (Manual 6 §1):
 *
 *   · GOOGLE_CLIENT_ID  viaja en cada petición de Google Identity Services; cualquiera que
 *                       abra la app lo ve. Su seguridad no está en ocultarlo sino en la
 *                       lista de orígenes autorizados de Google Cloud.
 *   · API_URL           es la URL del despliegue web de Apps Script. Quien la tenga puede
 *                       llamarla, y recibirá «Inicia sesión para continuar»: la puerta es
 *                       el ID token verificado en servidor, no el secreto de la URL.
 *
 * LO QUE NUNCA VA AQUÍ, ni en ningún archivo de este repositorio:
 *   · URL_LISTA_BLANCA        → propiedad del script, en el servidor
 *   · SECRETO_LISTA_BLANCA    → no debe existir (Manual 5 §D.9, modo 1)
 *   · el ID del Sheet de correos autorizados
 *
 * Las dos reglas del Manual 5 §D.1: el ID del Sheet nunca sale del servidor, y la
 * validación nunca ocurre en el navegador.
 */
window.SOLVO_CONFIG = {
  /* Reemplaza los dos valores. Mientras digan PEGA_, la app muestra su pantalla de
     configuración en vez de una página en blanco. */
  GOOGLE_CLIENT_ID: '507338667116-74rckgbm2fh6ddc8nq0q6ffg30l2pu22.apps.googleusercontent.com',
  API_URL: 'https://script.google.com/macros/s/AKfycbwEDZoWKrEjAI1tD5lhObB-tftapBlAmYqJJOinYkKEK-cd_Dvwwy_w30q5A4e-wgFwtw/exec',

  /* Moneda de presentación por defecto hasta que el servidor responda con la real. */
  MONEDA_BASE: 'PEN',

  /* Un ID token de Google dura una hora. Se renueva silenciosamente cuando quedan
     menos de estos minutos, para que una sesión larga no se corte a mitad de un
     formulario. */
  MINUTOS_MARGEN_TOKEN: 5,

  /* Versión del cascarón. La usa el Service Worker para invalidar su caché. */
  VERSION: '9.0.1'
};

/** ¿Están puestos los dos valores? Admite un reemplazo temporal por localStorage. */
window.SOLVO_CONFIG.completa = function () {
  const c = window.SOLVO_CONFIG;
  return !String(c.clientId()).startsWith('PEGA_') && !String(c.apiUrl()).startsWith('PEGA_');
};

/* La vía por localStorage existe para poder probar en una máquina sin tocar el
   repositorio. Lo definitivo es editar este archivo y publicarlo. */
window.SOLVO_CONFIG.clientId = function () {
  return localStorage.getItem('solvo.clientId') || window.SOLVO_CONFIG.GOOGLE_CLIENT_ID;
};
window.SOLVO_CONFIG.apiUrl = function () {
  return localStorage.getItem('solvo.apiUrl') || window.SOLVO_CONFIG.API_URL;
};
