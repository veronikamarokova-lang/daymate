import { useEffect, useState } from 'react';
import { BarChart3, CalendarDays, GraduationCap, Menu, Pill, Settings, Sparkles, Sun, type LucideIcon } from 'lucide-react';

export type Route = 'today' | 'timetable' | 'medications' | 'calendar' | 'habits' | 'stats' | 'settings' | 'more';

export const NAV: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: 'today', label: 'Мой день', icon: Sun },
  { route: 'timetable', label: 'Расписание', icon: GraduationCap },
  { route: 'medications', label: 'Лекарства', icon: Pill },
  { route: 'calendar', label: 'Календарь', icon: CalendarDays },
  { route: 'habits', label: 'Привычки', icon: Sparkles },
  { route: 'stats', label: 'Статистика', icon: BarChart3 },
  { route: 'settings', label: 'Настройки', icon: Settings },
];

/** На телефоне в нижней панели шесть пунктов: статистика и настройки спрятаны в «Ещё». */
const MORE = { route: 'more' as Route, label: 'Ещё', icon: Menu };
export const MORE_ROUTES: Route[] = ['stats', 'settings'];
export const MOBILE_NAV = [...NAV.filter((n) => !MORE_ROUTES.includes(n.route)), MORE];

const ROUTES: Route[] = [...NAV.map((n) => n.route), 'more'];

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
