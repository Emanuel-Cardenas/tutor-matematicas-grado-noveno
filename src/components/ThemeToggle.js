'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = async () => {
    const newTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    try {
      await fetch('/api/user/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch (error) {
      console.error('Failed to sync theme preference:', error);
    }
  };

  if (!mounted) {
    return <div style={{ width: 100, height: 32 }} />;
  }

  return (
    <button 
      onClick={toggleTheme}
      className="btn btn-ghost btn-sm"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-full)',
        background: 'rgba(42, 42, 42, 0.4)',
      }}
    >
      {resolvedTheme === 'dark' ? (
        <><span>☀️</span> Claro</>
      ) : (
        <><span>🌙</span> Oscuro</>
      )}
    </button>
  );
}
