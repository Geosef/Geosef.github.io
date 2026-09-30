import { useEffect, useLayoutEffect, type RefObject } from 'react';

/** Shrinks one element's font until its text fits its box, down to half size. */
function fitOne(el: HTMLElement) {
  el.style.fontSize = '';
  const box = el.clientWidth;
  const text = el.scrollWidth;
  if (box > 0 && text > box + 1) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = `${Math.max(size / 2, size * (box / text) * 0.98)}px`;
  }
}

/**
 * Names on the boards never truncate: every `.hd-fit` inside `ref` shrinks
 * until it fits its space. Rechecked after each render, on resize, and once
 * the display font has loaded (it's narrower than the fallback).
 */
export function useFit(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>('.hd-fit').forEach(fitOne);
  });
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const all = () => root.querySelectorAll<HTMLElement>('.hd-fit').forEach(fitOne);
    const ro = new ResizeObserver(all);
    ro.observe(root);
    document.fonts?.ready.then(all);
    return () => ro.disconnect();
  }, [ref]);
}
