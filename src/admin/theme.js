// Admin appearance: "system" (follow the device), "light" or "dark", remembered on this device.
// admin/index.html applies the saved choice before the page renders, so there is no flash.
import { useEffect, useState } from 'react';

const KEY = 'khs-admin-theme';
export const THEMES = ['system', 'light', 'dark'];

export function readThemePref() {
  try {
    const v = localStorage.getItem(KEY);
    return THEMES.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

function resolve(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(pref) {
  const theme = resolve(pref);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#10251f' : '#1f5246');
}

/** [pref, setPref]: applies the theme and keeps "system" in sync with the device. */
export function useThemePref() {
  const [pref, setPref] = useState(readThemePref);
  useEffect(() => {
    apply(pref);
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
    if (pref !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);
  return [pref, setPref];
}
