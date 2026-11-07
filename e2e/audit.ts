import { expect, type Page } from '@playwright/test';

export async function auditTargets(page: Page, min: number, where: string) {
  const violations = await page.evaluate((min) => {
    const sel = 'button, [role="button"], [role="tab"], [role="radio"], [role="option"], [role="switch"], input:not([type="hidden"]), select, textarea, a[href], [tabindex="0"]';
    const out: { el: string; name: string; w: number; h: number }[] = [];
    for (const el of Array.from(document.querySelectorAll(sel))) {
      const h = el as HTMLElement;
      if (h.closest('[aria-hidden="true"]')) continue;
      if ((el as HTMLInputElement).disabled) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      let target: Element = el;
      const type = (el as HTMLInputElement).type;
      if (type === 'checkbox' || type === 'radio') { const lab = el.closest('label'); if (lab) target = lab; }
      const r = target.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width + 0.5 < min || r.height + 0.5 < min) {
        const name = (el.getAttribute('aria-label') || el.textContent?.trim() || el.getAttribute('title') || (el as HTMLInputElement).placeholder || '').slice(0, 50);
        out.push({ el: el.tagName.toLowerCase() + '.' + (el.className.baseVal ?? el.className ?? '').toString().split(' ')[0], name, w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
    return out;
  }, min);
  expect(violations, `${where}: controls smaller than ${min}px`).toEqual([]);
}
