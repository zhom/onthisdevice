/**
 * True in the page when every island has hydrated, except a client:visible island below the fold:
 * that one hydrates only when it is scrolled to. Pass it to page.waitForFunction.
 */
export const hydrated = () =>
  [...document.querySelectorAll('astro-island[ssr]')].every(
    // The island is display: contents; its first child has the position.
    (el) => el.getAttribute('client') === 'visible' && (el.firstElementChild?.getBoundingClientRect().top ?? 0) > innerHeight,
  )
