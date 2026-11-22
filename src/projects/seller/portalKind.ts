/** How a product is presented as a 3D object in the Home portal. */
export type Kind = 'sheets' | 'book' | 'video' | 'icons' | 'display'

export function kindOf(p: { format?: string; fileType?: string | null; title: string }): Kind {
  const s = `${p.format ?? ''} ${p.fileType ?? ''} ${p.title}`.toLowerCase()
  if (/\b(pdf|epub|ebook|e-book|book|guide|workbook)\b/.test(s)) return 'book'
  if (/\b(mp4|mov|webm|video|course|lesson|reel)\b/.test(s)) return 'video'
  if (/\b(svg|icon|icons|emoji|sticker)\b/.test(s)) return 'icons'
  if (/\b(psd|template|templates|figma|canva|planner|notion|kit|pack|ai)\b/.test(s)) return 'sheets'
  return 'display'
}

