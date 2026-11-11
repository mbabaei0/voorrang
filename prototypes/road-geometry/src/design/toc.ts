// Marks the contents link of the section being read, and keeps it in view in the chip strip.
const links = [...document.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]')]
const sections = links
  .map((a) => document.getElementById(a.getAttribute('href')!.slice(1)))
  .filter((el): el is HTMLElement => !!el)

function setCurrent(id: string) {
  for (const a of links) {
    const on = a.getAttribute('href') === `#${id}`
    if (on) {
      a.setAttribute('aria-current', 'true')
      const strip = a.closest('ol')
      if (strip && strip.scrollWidth > strip.clientWidth) {
        const target = a.offsetLeft - (strip.clientWidth - a.offsetWidth) / 2
        strip.scrollTo({ left: target, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      }
    } else a.removeAttribute('aria-current')
  }
}

const visible = new Set<string>()
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)
    const first = sections.find((s) => visible.has(s.id))
    if (first) setCurrent(first.id)
  },
  { rootMargin: '-72px 0px -60% 0px' },
)
sections.forEach((s) => io.observe(s))
