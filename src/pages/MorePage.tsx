import { ChevronRight } from 'lucide-react';
import { hrefFor, MORE_ROUTES, NAV } from '../components/layout/nav';
import { Card, PageHeader } from '../components/ui/misc';

/** Пункты, которые не поместились в нижнюю панель телефона. */
export function MorePage() {
  return (
    <>
      <PageHeader title="Ещё" />
      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {NAV.filter((n) => MORE_ROUTES.includes(n.route)).map(({ route, label, icon: Icon }) => (
          <a key={route} href={hrefFor(route)} className="flex items-center gap-3 px-4 py-4 first:rounded-t-3xl last:rounded-b-3xl hover:bg-slate-50 dark:hover:bg-slate-800">
            <span className="grid size-10 place-items-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"><Icon size={19} /></span>
            <span className="flex-1 font-medium">{label}</span>
            <ChevronRight size={18} className="text-slate-400" />
          </a>
        ))}
      </Card>
    </>
  );
}
