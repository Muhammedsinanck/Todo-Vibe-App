import Dexie, { type EntityTable } from 'dexie';

export interface Task {
    id: string;          // UUID
    parentId: string;    // 'root' if it's top-level
    text: string;
    notes?: string;      // Optional notes for the task
    completed: boolean;
    dueDate: string | null;     // ISO String or null
    tags: string[];      // Array of strings
    order: number;       // For reordering siblings
    sectionOrder?: number; // For independent flat reordering inside Date sections
    isFocused?: boolean; // Whether the task is in the Focus queue
    focusOrder?: number; // Order within the flat Focus queue
    createdAt: number;   // Timestamp
}

const db = new Dexie('TodoDB') as Dexie & {
    tasks: EntityTable<
        Task,
        'id'
    >;
};

// We define our table and its indexes.
// parentId is indexed to quickly grab tree children.
// dueDate is indexed for quick section filtering.
// order is indexed for sorting siblings.
db.version(2).stores({
    tasks: 'id, parentId, dueDate, *tags, order, sectionOrder, isFocused, focusOrder',
}).upgrade(tx => {
    return tx.table('tasks').toCollection().modify(task => {
        task.isFocused = false;
        task.focusOrder = 0;
    });
});

export { db };
