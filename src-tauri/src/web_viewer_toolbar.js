// Flint's web viewer toolbar, added to every page it shows.
;(() => {
  if (window.top !== window || document.getElementById('flint-web-viewer')) return
  const add = () => {
    const host = document.createElement('div')
    host.id = 'flint-web-viewer'
    const root = host.attachShadow({ mode: 'closed' })
    const bar = document.createElement('div')
    Object.assign(bar.style, {
      position: 'fixed',
      zIndex: '2147483647',
      right: '12px',
      bottom: '12px',
      display: 'flex',
      gap: '2px',
      padding: '4px',
      borderRadius: '10px',
      background: 'rgba(30, 30, 30, 0.85)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
      font: '13px system-ui, sans-serif',
      opacity: '0.35',
      transition: 'opacity 0.15s',
    })
    bar.addEventListener('mouseenter', () => (bar.style.opacity = '1'))
    bar.addEventListener('mouseleave', () => (bar.style.opacity = '0.35'))
    const button = (label, title, action) => {
      const element = document.createElement('button')
      element.textContent = label
      element.title = title
      Object.assign(element.style, {
        minWidth: '30px',
        height: '28px',
        padding: '0 8px',
        border: 'none',
        borderRadius: '6px',
        background: 'transparent',
        color: '#eee',
        font: 'inherit',
        cursor: 'pointer',
      })
      element.addEventListener(
        'mouseenter',
        () => (element.style.background = 'rgba(255, 255, 255, 0.15)'),
      )
      element.addEventListener('mouseleave', () => (element.style.background = 'transparent'))
      element.addEventListener('click', action)
      bar.append(element)
    }
    button('←', 'Back', () => history.back())
    button('→', 'Forward', () => history.forward())
    button('↻', 'Reload', () => location.reload())
    button('Go to…', 'Open another address', () => {
      const address = prompt('Address', location.href)
      if (!address) return
      location.href = /^[a-z][a-z\d+.-]*:/i.test(address) ? address : `https://${address}`
    })
    button(
      'Copy link',
      'Copy this page’s address',
      () => void navigator.clipboard?.writeText(location.href),
    )
    button('Open in browser', 'Open this page in your browser', () => {
      location.href = `flint-open-in-browser://open?url=${encodeURIComponent(location.href)}`
    })
    root.append(bar)
    document.documentElement.append(host)
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add)
  else add()
})()
