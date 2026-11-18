// Never run a cached build. GitHub Pages sends every file with
// max-age=600 and gives us no way to change that, so a refresh can hand
// back an index.html from the previous release. This compares the build
// stamped into this HTML with /version.json (fetched past the cache) and
// forces one fresh load of the current release when they differ.
;(function () {
  var BUILD = document.currentScript.dataset.build
  if (!BUILD || BUILD.indexOf('%') === 0) return
  var params = new URLSearchParams(window.location.search)
  if (params.get('v') === BUILD) {
    // Already forced a fresh load: tidy the URL back to normal.
    params.delete('v')
    var qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash)
  }
  function check() {
    fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null })
      .then(function (v) {
        if (!v || !v.build || v.build === BUILD) {
          try { sessionStorage.removeItem('dn-build-reload') } catch (e) {}
          return
        }
        try {
          // One attempt per build, so a half-propagated deploy can never loop.
          if (sessionStorage.getItem('dn-build-reload') === v.build) return
          sessionStorage.setItem('dn-build-reload', v.build)
        } catch (e) {}
        var u = new URL(window.location.href)
        u.searchParams.set('v', v.build)
        window.location.replace(u.toString())
      })
      .catch(function () {})
  }
  check()
})()
