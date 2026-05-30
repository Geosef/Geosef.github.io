import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle({ className = 'gl-theme-toggle' }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button className={className} onClick={toggle} aria-label={label} title={label}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
