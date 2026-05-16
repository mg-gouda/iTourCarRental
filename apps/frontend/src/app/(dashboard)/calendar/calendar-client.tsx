'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks,
  eachDayOfInterval, format, isSameDay, isToday,
  differenceInCalendarDays, parseISO, startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

import { bookingsApi, CalendarEntry, BookingStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';

// ─── Status colors ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<BookingStatus, string> = {
  HOLD: 'bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700',
  CONFIRMED: 'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100 border-blue-300 dark:border-blue-700',
  ACTIVE: 'bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-100 border-green-300 dark:border-green-700',
  COMPLETED: 'bg-muted text-muted-foreground border-border',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800',
  NO_SHOW: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800',
  OVERDUE: 'bg-orange-200 text-orange-900 dark:bg-orange-800 dark:text-orange-100 border-orange-300 dark:border-orange-700',
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  HOLD: 'Hold', CONFIRMED: 'Confirmed', ACTIVE: 'Active',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled', NO_SHOW: 'No Show', OVERDUE: 'Overdue',
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function BookingTooltip({ entry }: { entry: CalendarEntry }) {
  return (
    <div className="absolute z-50 left-0 top-full mt-1 w-56 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-3 text-xs space-y-1 pointer-events-none">
      <p className="font-mono font-semibold">{entry.bookingNumber}</p>
      <p>{entry.customer.fullName}</p>
      <p className="text-muted-foreground">
        {entry.car.make} {entry.car.model} · {entry.car.licensePlate}
      </p>
      <p className="text-muted-foreground">
        {format(parseISO(entry.pickupAt), 'dd MMM HH:mm')} → {format(parseISO(entry.returnAt), 'dd MMM HH:mm')}
      </p>
      <p className="text-muted-foreground">{entry.pickupBranch.name} → {entry.returnBranch.name}</p>
      <span className={`inline-block rounded border px-1.5 py-0.5 font-medium ${STATUS_COLOR[entry.status]}`}>
        {STATUS_LABEL[entry.status]}
      </span>
    </div>
  );
}

// ─── Gantt bar ────────────────────────────────────────────────────────────────

interface GanttBarProps {
  entry: CalendarEntry;
  days: Date[];
  rowIdx: number;
}

function GanttBar({ entry, days }: GanttBarProps) {
  const [hover, setHover] = useState(false);
  const firstDay = startOfDay(days[0]);
  const lastDay = startOfDay(days[days.length - 1]);
  const pickupDay = startOfDay(parseISO(entry.pickupAt));
  const returnDay = startOfDay(parseISO(entry.returnAt));

  const startCol = Math.max(0, differenceInCalendarDays(pickupDay, firstDay));
  const endCol = Math.min(days.length - 1, differenceInCalendarDays(returnDay, firstDay));
  if (startCol > days.length - 1 || endCol < 0) return null;

  const spanCols = Math.max(1, endCol - startCol + 1);
  const totalCols = days.length;

  const left = `${(startCol / totalCols) * 100}%`;
  const width = `calc(${(spanCols / totalCols) * 100}% - 4px)`;

  return (
    <div
      className="absolute inset-y-1"
      style={{ left, width }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className={`relative h-full rounded border text-[11px] font-medium px-2 flex items-center truncate cursor-pointer transition-opacity hover:opacity-90 ${STATUS_COLOR[entry.status]}`}>
        {entry.customer.fullName}
        {hover && <BookingTooltip entry={entry} />}
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const LEGEND_STATUSES: BookingStatus[] = ['HOLD', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'OVERDUE', 'CANCELLED'];

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {LEGEND_STATUSES.map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded-sm border ${STATUS_COLOR[s]}`} />
          {STATUS_LABEL[s]}
        </div>
      ))}
    </div>
  );
}

// ─── Calendar client ──────────────────────────────────────────────────────────

export default function CalendarClient() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const from = format(weekStart, "yyyy-MM-dd'T'00:00:00");
  const to = format(endOfWeek(weekStart, { weekStartsOn: 1 }), "yyyy-MM-dd'T'23:59:59");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['calendar', from, to],
    queryFn: () => bookingsApi.calendar(from, to),
  });

  const days = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) }),
    [weekStart],
  );

  // Group bookings by car
  const carRows = useMemo(() => {
    const map = new Map<string, { car: CalendarEntry['car']; entries: CalendarEntry[] }>();
    for (const entry of entries) {
      const existing = map.get(entry.car.id);
      if (existing) {
        existing.entries.push(entry);
      } else {
        map.set(entry.car.id, { car: entry.car, entries: [entry] });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.car.make} ${a.car.model}`.localeCompare(`${b.car.make} ${b.car.model}`),
    );
  }, [entries]);

  const goToToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const goBack = () => setWeekStart((w) => subWeeks(w, 1));
  const goForward = () => setWeekStart((w) => addWeeks(w, 1));

  return (
    <div className="space-y-4">
      {/* Navigation bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          <Button variant="ghost" size="sm" className="rounded-none h-8 px-2 border-r border-border" onClick={goBack}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="px-4 text-sm font-medium">
            {format(days[0], 'dd MMM')} – {format(days[days.length - 1], 'dd MMM yyyy')}
          </span>
          <Button variant="ghost" size="sm" className="rounded-none h-8 px-2 border-l border-border" onClick={goForward}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          <CalendarDays className="w-4 h-4 mr-1" /> Today
        </Button>
        <Legend />
      </div>

      {/* Gantt grid */}
      <div className="rounded-xl border border-border overflow-auto">
        <table className="w-full table-fixed border-collapse min-w-[700px]">
          <colgroup>
            <col style={{ width: '180px' }} />
            {days.map((_, i) => <col key={i} style={{ width: `${100 / days.length}%` }} />)}
          </colgroup>
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-b border-border">
                Car
              </th>
              {days.map((day) => (
                <th
                  key={day.toISOString()}
                  className={`px-1 py-2 text-center text-xs font-medium border-b border-border border-l ${isToday(day) ? 'bg-primary/5 text-primary font-semibold' : 'text-muted-foreground'}`}
                >
                  <div>{format(day, 'EEE')}</div>
                  <div className={`mt-0.5 w-6 h-6 mx-auto rounded-full flex items-center justify-center text-xs ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}`}>
                    {format(day, 'd')}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={days.length + 1} className="px-3 py-8 text-center text-muted-foreground text-sm">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && carRows.length === 0 && (
              <tr>
                <td colSpan={days.length + 1} className="px-3 py-12 text-center text-muted-foreground text-sm">
                  No bookings this week.
                </td>
              </tr>
            )}
            {carRows.map(({ car, entries: carEntries }) => (
              <tr key={car.id} className="group hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2 text-xs border-b border-border bg-background group-hover:bg-muted/20 transition-colors">
                  <div className="font-medium">{car.make} {car.model} {car.year}</div>
                  <div className="font-mono text-muted-foreground">{car.licensePlate}</div>
                </td>
                {/* Gantt cell spanning all day columns */}
                <td colSpan={days.length} className="border-b border-border p-0 relative h-12">
                  <div className="relative h-full w-full">
                    {/* Day grid lines */}
                    {days.map((_, i) => (
                      <div
                        key={i}
                        className={`absolute inset-y-0 border-l border-border/50 ${isToday(days[i]) ? 'bg-primary/5' : ''}`}
                        style={{ left: `${(i / days.length) * 100}%`, width: `${100 / days.length}%` }}
                      />
                    ))}
                    {/* Booking bars */}
                    {carEntries.map((entry) => (
                      <GanttBar key={entry.id} entry={entry} days={days} rowIdx={0} />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
