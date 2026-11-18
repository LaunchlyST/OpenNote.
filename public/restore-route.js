// Restore links forwarded by older GitHub Pages fallback pages.
const route = new URLSearchParams(location.search).get('route')
if (route?.startsWith('/')) {
  const target = new URL(route, location.origin)
  if (target.origin === location.origin) history.replaceState(null, '', target)
}
