import { db, auth } from './firebase';

export interface Task {
    id: string;
    parentId: string;
    text: string;
    notes?: string;
    completed: boolean;
    dueDate: string | null;
    tags: string[];
    order: number;
    sectionOrder?: number;
    isFocused?: boolean;
    focusOrder?: number;
    createdAt: number;
    userId: string;
}

export { db, auth };
