import { useEffect } from 'react';
import { useStore } from './store/AppStore';
import { AppShell } from './components/layout/AppShell';
import { useRoute, type Route } from './components/layout/nav';
import { TodayPage } from './pages/TodayPage';
import { MedicationsPage } from './pages/MedicationsPage';
import { CalendarPage } from './pages/CalendarPage';
import { HabitsPage } from './pages/HabitsPage';
import { StatsPage } from './pages/StatsPage';
import { SettingsPage } from './pages/SettingsPage';
import { TimetablePage } from './pages/TimetablePage';
import { MorePage } from './pages/MorePage';

const PAGES: Record<Route, () => React.JSX.Element> = {
  today: TodayPage,
  timetable: TimetablePage,
  medications: MedicationsPage,
  calendar: CalendarPage,
  habits: HabitsPage,
  stats: StatsPage,
  settings: SettingsPage,
  more: MorePage,
};

function useTheme() {
  const { theme } = useStore().data.settings;
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#020617' : '#f8fafc');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

export function App() {
  useTheme();
  const route = useRoute();
  const Page = PAGES[route];
  return (
    <AppShell route={route}>
      <Page />
    </AppShell>
  );
}
