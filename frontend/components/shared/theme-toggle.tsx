'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';

const DURATION_MS = 550;

/**
 * Switches theme with a circular reveal that grows from the toggle button (View Transitions API).
 * Falls back to an instant switch when the API is unavailable or the user prefers reduced motion.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!document.startViewTransition || reduceMotion || !buttonRef.current) {
      setTheme(next);
      return;
    }

    const { left, top, width, height } = buttonRef.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    // Distance to the farthest viewport corner, so the circle covers the whole screen.
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = document.startViewTransition(() => {
      // Apply the class synchronously so the "new" snapshot already has the next theme;
      // next-themes then persists the choice.
      root.classList.toggle('dark', next === 'dark');
      root.style.colorScheme = next;
      setTheme(next);
    });

    void transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: DURATION_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  };

  return (
    <Button ref={buttonRef} variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggle}>
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
