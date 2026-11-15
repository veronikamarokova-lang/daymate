import { useEffect, useState } from 'react';
import { BarChart3, CalendarDays, Pill, Settings, Sparkles, Sun, type LucideIcon } from 'lucide-react';

export type Route = 'today' | 'medications' | 'calendar' | 'habits' | 'stats' | 'settings';

export const NAV: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: 'today', label: 'Мой день', icon: Sun },
  { route: 'medications', label: 'Лекарства', icon: Pill },
  { route: 'calendar', label: 'Календарь', icon: CalendarDays },
  { route: 'habits', label: 'Привычки', icon: Sparkles },
  { route: 'stats', label: 'Статистика', icon: BarChart3 },
  { route: 'settings', label: 'Настройки', icon: Settings },
];

const ROUTES = NAV.map((n) => n.route);

function parseHash(): Route {
  const name = window.location.hash.replace(/^#\/?/, '') || 'today';
  return ROUTES.includes(name as Route) ? (name as Route) : 'today';
}

export const hrefFor = (route: Route) => (route === 'today' ? '#/' : `#/${route}`);

/** Лёгкая маршрутизация по hash: работает без сервера и переживает перезагрузку. */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
