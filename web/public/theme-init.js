// Runs before the page paints so a dark-mode visitor never sees a white flash.
// Kept in a separate file because the server's Content-Security-Policy blocks
// inline scripts. Keep the storage key in sync with web/lib/useTheme.ts.
;(function () {
  var theme = null
  try {
    theme = localStorage.getItem('printflow-theme')
  } catch {
    // Storage can be unavailable (private mode); fall back to the system setting.
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
  }
  document.documentElement.classList.toggle('dark', theme === 'dark')
})()
