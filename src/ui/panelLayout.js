// Read the rendered docking mode so touch tablets and narrow windows agree with CSS.
export function campusPanelLayout() {
  const element = document.querySelector('.campus-panel')
  if (!element) return null
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  return {
    rect,
    bottomDocked: window.getComputedStyle(element).position === 'fixed',
    collapsed: element.classList.contains('is-collapsed'),
  }
}
