import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { entryApi } from '../services/entryApi';
import { useBabyStore } from '../stores/authStore';

export default function CalendarPage() {
  const currentBaby = useBabyStore((state) => state.currentBaby);
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: calendarData } = useQuery({
    queryKey: ['calendar', currentBaby?.id, currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: () =>
      entryApi.getCalendarData(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1
      ),
    enabled: !!currentBaby,
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const hasEntryDates = (calendarData?.data || []).map((d: string) => new Date(d));

  const hasEntry = (day: Date) =>
    hasEntryDates.some((d: Date) => isSameDay(d, day));

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const firstDayOfWeek = getDay(monthStart);

  return (
    <div className="calendar-page">
      <header className="calendar-header">
        <h1>
          {format(currentDate, 'yyyy年MM月', { locale: zhCN })}
        </h1>
        <div className="month-nav">
          <button
            onClick={() =>
              setCurrentDate(
                new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
              )
            }
          >
            ◀
          </button>
          <button
            onClick={() =>
              setCurrentDate(
                new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
              )
            }
          >
            ▶
          </button>
        </div>
      </header>

      <div className="calendar-grid">
        {weekDays.map((day) => (
          <div key={day} className="week-day">
            {day}
          </div>
        ))}

        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="calendar-day empty" />
        ))}

        {days.map((day, index) => {
          const isToday = isSameDay(day, new Date());
          const hasEntryOnDay = hasEntry(day);

          return (
            <motion.div
              key={day.toISOString()}
              className={`calendar-day ${isToday ? 'today' : ''} ${
                hasEntryOnDay ? 'has-entry' : ''
              }`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.01 }}
            >
              <span className="day-number">{format(day, 'd')}</span>
              {hasEntryOnDay && <span className="entry-dot" />}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
