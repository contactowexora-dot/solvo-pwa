/**
 * SOLVO — Service Worker (cascarón, Paso 9).
 *
 * ALCANCE DE ESTE PASO: cachear el cascarón para que la app abra sin conexión y sea
 * instalable. **La cola de escrituras sin conexión es del Paso 13** y no está aquí.
 *
 * DOS DECISIONES QUE CONVIENE ENTENDER
 *
 * 1. **Las llamadas a la API no se cachean.** Ni una. Un saldo de hace tres horas mostrado
 *    como si fuera de ahora es peor que no mostrar nada: la persona toma una decisión de
 *    dinero con un número falso y no tiene forma de saberlo. Sin conexión, la app dice que
 *    está sin conexión. El Paso 13 añadirá una caché de lecturas **con marca de tiempo
 *    visible**, que es otra cosa.
 *
 * 2. **El script de Google Identity no se cachea.** Google lo prohíbe expresamente y se
 *    autoactualiza; una copia vieja rompería el acceso de forma difícil de diagnosticar.
 *    Por eso la puerta de acceso es la única pantalla que exige estar en línea.
 */

const VERSION = 'solvo-cascaron-v13.0.0';

/* Todo con ./ para que funcione bajo el subdirectorio de GitHub Pages
   (usuario.github.io/repo/), donde la raíz absoluta «/» no es la de la app. */
const DEL_CASCARON = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/componentes.css',
  './js/config.js',
  './js/ui.js',
  './js/api.js',
  './js/auth.js',
  './js/app.js',
  './js/campos.js',
  './js/formularios.js',
  './js/form-gasto.js',
  './js/form-ingreso.js',
  './js/form-mover.js',
  './js/form-producto.js',
  './js/productos.js',
  './js/movimientos.js',
  './js/graficos.js',
  './js/inicio.js',
  './js/dashboard.js',
  './vendor/echarts.min.js',
  './assets/icons-sprite.svg',
  './assets/icono.svg'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil((async function () {
    const cache = await caches.open(VERSION);
    // Uno a uno en vez de addAll: si un archivo falla, addAll aborta la instalación entera
    // y el usuario se queda sin Service Worker por una fuente que no existe todavía.
    await Promise.all(DEL_CASCARON.map(async function (url) {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (e) {
        console.warn('[sw] no pude cachear', url, e && e.message);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil((async function () {
    const nombres = await caches.keys();
    await Promise.all(nombres.map(function (n) {
      return n === VERSION ? null : caches.delete(n);
    }));
    // Sin esto la pestaña abierta sigue con el worker viejo hasta que se cierre del todo.
    await self.clients.claim();
  })());
});

/** ¿Es una petición que NUNCA debe pasar por caché? */
function nuncaCachear(url) {
  return url.hostname === 'script.google.com' ||
         url.hostname === 'script.googleusercontent.com' ||
         url.hostname === 'accounts.google.com' ||
         url.hostname === 'oauth2.googleapis.com' ||
         url.hostname.endsWith('.googleusercontent.com');
}

self.addEventListener('fetch', function (evento) {
  const pet = evento.request;

  // Solo GET. Un POST cacheado sería un movimiento duplicado.
  if (pet.method !== 'GET') return;

  const url = new URL(pet.url);
  if (nuncaCachear(url)) return;              // va a la red, sin intermediarios
  if (url.origin !== self.location.origin) return;

  // Navegaciones: red primero para recoger un despliegue nuevo, caché como red de
  // seguridad. Al revés, un usuario con la app instalada se quedaría clavado en la
  // versión del día que la instaló.
  if (pet.mode === 'navigate') {
    evento.respondWith((async function () {
      try {
        const resp = await fetch(pet);
        const cache = await caches.open(VERSION);
        cache.put('./index.html', resp.clone());
        return resp;
      } catch (e) {
        const cache = await caches.open(VERSION);
        return (await cache.match('./index.html')) ||
               (await cache.match('./')) ||
               new Response('Sin conexión y sin copia guardada.', {
                 status: 503, headers: { 'Content-Type': 'text/plain;charset=utf-8' }
               });
      }
    })());
    return;
  }

  /**
   * El código propio —JS y CSS— va a RED PRIMERO, con la caché como respaldo.
   *
   * Antes era caché primero con revalidación en segundo plano, y es el enfoque habitual para
   * estáticos: sirve al instante y actualiza para la próxima. El problema es «para la
   * próxima»: publicas un arreglo, recargas, y sigues viendo el código viejo. Pasa una vez y
   * es una curiosidad; pasa tres y te has ido a buscar un bug que ya estaba corregido.
   *
   * El coste real es una petición condicional por archivo, que con `ETag` vuelve como 304 y
   * no transfiere nada. La app sigue abriendo sin conexión porque la caché responde en cuanto
   * la red falla. Para un producto que cambia cada semana, ese cambio vale la pena.
   */
  const esCodigoPropio = /\.(js|css)$/i.test(url.pathname);

  evento.respondWith((async function () {
    const cache = await caches.open(VERSION);

    if (esCodigoPropio) {
      try {
        const resp = await fetch(pet);
        if (resp && resp.ok) cache.put(pet, resp.clone());
        return resp;
      } catch (e) {
        return (await cache.match(pet)) || new Response('', { status: 504 });
      }
    }

    // Lo demás —sprite, iconos, la librería de gráficos— sí va a caché primero: son
    // archivos grandes que no cambian entre despliegues.
    const guardado = await cache.match(pet);
    if (guardado) {
      fetch(pet).then(function (r) {
        if (r && r.ok) cache.put(pet, r.clone());
      }).catch(function () { /* sin red: la copia guardada sigue valiendo */ });
      return guardado;
    }
    try {
      const resp = await fetch(pet);
      if (resp && resp.ok) cache.put(pet, resp.clone());
      return resp;
    } catch (e) {
      return new Response('', { status: 504 });
    }
  })());
});

/** Permite que la app fuerce la activación de una versión nueva sin cerrar la pestaña. */
self.addEventListener('message', function (evento) {
  if (evento.data === 'activar-ya') self.skipWaiting();
});
