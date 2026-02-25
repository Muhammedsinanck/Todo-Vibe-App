import React, { useState } from 'react';
import { type SectionFilter, type StatusFilter } from '../db/hooks';
import { ListTodo, Calendar, Clock, Archive, CalendarDays, Sun, Moon, Sparkles, Target } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

type Props = {
    currentFilter: SectionFilter;
    onFilterChange: (f: SectionFilter) => void;
    statusFilter: StatusFilter;
    onStatusFilterChange: (s: StatusFilter) => void;
    theme: 'light' | 'twilight' | 'midnight';
    onThemeChange: (t: 'light' | 'twilight' | 'midnight') => void;
};

export const Sidebar: React.FC<Props> = ({ currentFilter, onFilterChange, statusFilter, onStatusFilterChange, theme, onThemeChange }) => {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

    const navs = [
        { id: 'focus', icon: Target, label: 'Focus Priority', color: 'text-teal-500' },
        { id: 'all', icon: ListTodo, label: 'Inbox', color: 'text-purple-600' },
        { id: 'today', icon: Calendar, label: 'Today', color: 'text-emerald-600' },
        { id: 'upcoming', icon: Clock, label: 'Upcoming', color: 'text-blue-600' },
        { id: 'past', icon: Archive, label: 'Past / Completed', color: 'text-orange-600' },
        { id: 'no-date', icon: CalendarDays, label: 'No Date', color: 'text-slate-500' },
    ] as const;

    const handleApplyDateRange = () => {
        onFilterChange({ type: 'dateRange', start: startDate, end: endDate });
        setShowDatePicker(false);
    };

    const handleApplyMonth = () => {
        if (!monthFilter) return;
        const [year, month] = monthFilter.split('-');
        onFilterChange({ type: 'month', year: parseInt(year), month: parseInt(month) });
        setShowDatePicker(false);
    };

    const handleApplyYear = () => {
        if (!yearFilter) return;
        onFilterChange({ type: 'year', year: parseInt(yearFilter) });
        setShowDatePicker(false);
    };

    const isFilterActive = (id: string) => {
        if (typeof currentFilter === 'string') return currentFilter === id;
        if (id === 'custom') return typeof currentFilter === 'object';
        return false;
    };

    return (
        <aside className="w-64 flex flex-col pt-8 pb-4 bg-theme-glass backdrop-blur-xl border border-theme-glass-border m-4 mr-0 rounded-2xl p-4 gap-6 z-10 shadow-sm overflow-y-auto">
            <div className="flex items-center gap-3 px-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
                    T
                </div>
                <span className="font-bold text-xl tracking-tight text-theme-text-inv">Tasks</span>
            </div>

            <nav className="flex flex-col gap-1">
                {navs.map(n => (
                    <button
                        key={n.id}
                        onClick={() => onFilterChange(n.id)}
                        className={clsx(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
                            isFilterActive(n.id)
                                ? "bg-theme-accent-bg text-theme-accent shadow-sm border border-theme-accent-bg"
                                : "text-theme-muted hover:text-theme-text hover:bg-theme-hover"
                        )}
                    >
                        <n.icon size={18} className={n.color} />
                        {n.label}
                    </button>
                ))}

                <div className="my-2 border-t border-theme-border"></div>

                <div className="flex flex-col gap-1 w-full">
                    <button
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        className={clsx(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium w-full",
                            isFilterActive('custom')
                                ? "bg-theme-accent-bg text-theme-accent shadow-sm border border-theme-accent-bg"
                                : "text-theme-muted hover:text-theme-text hover:bg-theme-hover"
                        )}
                    >
                        <CalendarDays size={18} className="text-theme-accent" />
                        Custom Filters
                    </button>

                    {showDatePicker && (
                        <div className="flex flex-col gap-4 mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 animate-in mx-1">
                            {/* Date Range */}
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-slate-500">Date Range</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white border rounded p-1 text-xs" />
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white border rounded p-1 text-xs" />
                                </div>
                                <button onClick={handleApplyDateRange} className="text-xs bg-slate-200 hover:bg-slate-300 py-1 rounded transition-colors font-medium">Apply Range</button>
                            </div>

                            {/* Month */}
                            <div className="flex flex-col gap-2 border-t border-slate-200 pt-2">
                                <span className="text-xs font-semibold text-slate-500">By Month</span>
                                <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="bg-white border rounded p-1.5 text-xs w-full" />
                                <button onClick={handleApplyMonth} className="text-xs bg-slate-200 hover:bg-slate-300 py-1 rounded transition-colors font-medium">Apply Month</button>
                            </div>

                            {/* Year */}
                            <div className="flex flex-col gap-2 border-t border-slate-200 pt-2">
                                <span className="text-xs font-semibold text-slate-500">By Year</span>
                                <input type="number" min="2000" max="2100" value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="bg-white border rounded p-1.5 text-xs w-full" />
                                <button onClick={handleApplyYear} className="text-xs bg-slate-200 hover:bg-slate-300 py-1 rounded transition-colors font-medium">Apply Year</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                    <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider px-3">Status</span>
                    <div className="flex rounded-lg bg-theme-input-bg p-1 border border-theme-glass-border">
                        {(['all', 'incomplete', 'completed'] as const).map(status => (
                            <button
                                key={status}
                                onClick={() => onStatusFilterChange(status)}
                                className={clsx(
                                    "flex-1 text-xs py-1.5 rounded-md font-medium capitalize transition-all",
                                    statusFilter === status
                                        ? "bg-theme-glass-solid text-theme-text shadow-sm border border-theme-border"
                                        : "text-theme-muted hover:text-theme-text"
                                )}
                            >
                                {status === 'all' ? 'All' : status}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-auto flex flex-col gap-2 pt-4">
                    <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider px-3">Theme</span>
                    <div className="flex gap-2">
                        <button onClick={() => onThemeChange('light')} className={clsx("flex-1 p-2 rounded-lg flex justify-center border transition-colors", theme === 'light' ? "bg-theme-accent-bg border-theme-accent text-theme-accent" : "border-theme-glass-border text-theme-muted hover:bg-theme-hover")} title="Light"><Sun size={18} /></button>
                        <button onClick={() => onThemeChange('twilight')} className={clsx("flex-1 p-2 rounded-lg flex justify-center border transition-colors", theme === 'twilight' ? "bg-theme-accent-bg border-theme-accent text-theme-accent" : "border-theme-glass-border text-theme-muted hover:bg-theme-hover")} title="Twilight"><Sparkles size={18} /></button>
                        <button onClick={() => onThemeChange('midnight')} className={clsx("flex-1 p-2 rounded-lg flex justify-center border transition-colors", theme === 'midnight' ? "bg-theme-accent-bg border-theme-accent text-theme-accent" : "border-theme-glass-border text-theme-muted hover:bg-theme-hover")} title="Midnight"><Moon size={18} /></button>
                    </div>
                </div>
            </nav>
        </aside>
    );
};
