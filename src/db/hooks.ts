import { useCollectionData } from 'react-firebase-hooks/firestore';
import { collection, query } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth, type Task } from './db';
import { startOfDay, endOfDay, isBefore, isAfter, isWithinInterval } from 'date-fns';

export type SectionFilter = 'all' | 'today' | 'upcoming' | 'past' | 'no-date' | 'focus' | { type: 'dateRange', start: string, end: string } | { type: 'month', year: number, month: number } | { type: 'year', year: number };

export type StatusFilter = 'all' | 'completed' | 'incomplete';

export function useTasks(filter: SectionFilter, statusFilter: StatusFilter = 'all') {
    const [user] = useAuthState(auth);
    const tasksRef = user ? collection(db, 'users', user.uid, 'tasks') : null;
    const q = tasksRef ? query(tasksRef) : null;

    const [tasksData, loading] = useCollectionData(q);

    if (loading || !tasksData) return undefined;

    let tasks = tasksData as Task[];

    // Sort heavily by order so they appear in sequence
    tasks.sort((a, b) => a.order - b.order);

    // Apply status filter first
    if (statusFilter === 'completed') {
        tasks = tasks.filter(t => t.completed);
    } else if (statusFilter === 'incomplete') {
        tasks = tasks.filter(t => !t.completed);
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const parseLocal = (dStr: string) => {
        const parts = dStr.split('-');
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    };

    if (filter === 'focus') {
        return tasks
            .filter(t => t.isFocused)
            // Override default sorting to use specific focusOrder
            .sort((a, b) => (a.focusOrder || 0) - (b.focusOrder || 0));
    }

    if (filter === 'all') {
        return tasks;
    }

    if (filter === 'no-date') {
        return tasks.filter(t => !t.dueDate);
    }

    if (filter === 'today') {
        return tasks.filter(t => t.dueDate && isWithinInterval(parseLocal(t.dueDate), { start: todayStart, end: todayEnd }));
    }

    if (filter === 'upcoming') {
        return tasks.filter(t => t.dueDate && isAfter(parseLocal(t.dueDate), todayEnd));
    }

    if (filter === 'past') {
        // Note: If using 'past', usually we show completed AND past due.
        // But since statusFilter is applied above, we just respect the time rule.
        return tasks.filter(t => t.completed || (t.dueDate && isBefore(parseLocal(t.dueDate), todayStart)));
    }

    if (typeof filter === 'object') {
        if (filter.type === 'dateRange') {
            const { start, end } = filter;
            const startDate = parseLocal(start);
            const endDate = parseLocal(end);
            return tasks.filter(t => t.dueDate && isWithinInterval(parseLocal(t.dueDate), { start: startDate, end: endDate }));
        }
        if (filter.type === 'month') {
            return tasks.filter(t => {
                if (!t.dueDate) return false;
                const d = parseLocal(t.dueDate);
                return d.getFullYear() === filter.year && d.getMonth() + 1 === filter.month;
            });
        }
        if (filter.type === 'year') {
            return tasks.filter(t => {
                if (!t.dueDate) return false;
                const d = parseLocal(t.dueDate);
                return d.getFullYear() === filter.year;
            });
        }
    }

    return tasks;
}

export function useTags() {
    const [user] = useAuthState(auth);
    const tasksRef = user ? collection(db, 'users', user.uid, 'tasks') : null;
    const q = tasksRef ? query(tasksRef) : null;

    // We only need read access, ignore loading block here
    const [tasksData] = useCollectionData(q);

    if (!tasksData) return [];

    const tags = new Set<string>();
    (tasksData as Task[]).forEach(t => (t.tags || []).forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
}
