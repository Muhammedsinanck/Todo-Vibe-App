import { db, type Task } from './db';
import { history, type Operation } from './history';

const generateId = () => crypto.randomUUID();

export const actions = {
    async addTask(
        text: string,
        parentId: string = 'root',
        tags: string[] = [],
        dueDate: string | null = null,
        insertAfterOrder?: number
    ) {
        let orderToUse: number;
        const siblings = await db.tasks.where('parentId').equals(parentId).toArray();
        let batchOps: Operation[] = [];

        if (insertAfterOrder !== undefined) {
            orderToUse = insertAfterOrder + 1;
            const siblingsToShift = siblings.filter(s => s.order >= orderToUse);
            for (const sib of siblingsToShift) {
                const newOrder = sib.order + 1;
                batchOps.push({
                    type: 'UPDATE',
                    taskId: sib.id,
                    prevUpdateSnapshot: { order: sib.order },
                    newUpdateSnapshot: { order: newOrder }
                });
                await db.tasks.update(sib.id, { order: newOrder });
            }
        } else {
            const maxOrder = Math.max(0, ...siblings.map(s => s.order));
            orderToUse = maxOrder + 1;
        }

        const newTask: Task = {
            id: generateId(),
            parentId,
            text,
            notes: '',
            completed: false,
            dueDate,
            tags,
            order: orderToUse,
            createdAt: Date.now(),
        };

        batchOps.push({ type: 'ADD', taskId: newTask.id, taskSnapshot: newTask });
        await db.tasks.add(newTask);

        history.push({ type: 'BATCH', batchOperations: batchOps });
        return newTask;
    },

    async updateTask(id: string, updates: Partial<Task>) {
        const existing = await db.tasks.get(id);
        if (!existing) return;

        // Extract only the fields being changed for snapshotting
        const prevSnapshot: Partial<Task> = {};
        for (const key of Object.keys(updates) as Array<keyof Task>) {
            // @ts-ignore
            prevSnapshot[key] = existing[key];
        }

        history.push({
            type: 'UPDATE',
            taskId: id,
            prevUpdateSnapshot: prevSnapshot,
            newUpdateSnapshot: updates
        });

        return db.tasks.update(id, updates);
    },

    async toggleTaskCompletion(id: string, completed: boolean) {
        return this.updateTask(id, { completed });
    },

    async deleteTask(id: string) {
        const toDeleteIds = [id];
        let index = 0;

        // BFS to find all children recursively
        while (index < toDeleteIds.length) {
            const currentId = toDeleteIds[index];
            const children = await db.tasks.where('parentId').equals(currentId).toArray();
            for (const child of children) {
                toDeleteIds.push(child.id);
            }
            index++;
        }

        const tasksToDelete = await db.tasks.where('id').anyOf(toDeleteIds).toArray();
        const batchOps: Operation[] = tasksToDelete.map(t => ({
            type: 'DELETE',
            taskId: t.id,
            taskSnapshot: t
        }));

        history.push({ type: 'BATCH', batchOperations: batchOps });
        await db.tasks.bulkDelete(toDeleteIds);
    },

    async reorderSiblings(draggedId: string, newParentId: string, dropIndex: number) {
        const draggedTask = await db.tasks.get(draggedId);
        if (!draggedTask) return;

        const originalParent = draggedTask.parentId;
        const originalOrder = draggedTask.order;

        // Get all siblings in target parent (excluding the dragged item if it was already there)
        const targetSiblings = await db.tasks.where('parentId').equals(newParentId).toArray();
        const listToReorder = targetSiblings
            .filter(t => t.id !== draggedId)
            .sort((a, b) => a.order - b.order);

        // Splice the dragged item into the exact new drop index position
        listToReorder.splice(dropIndex, 0, draggedTask);

        const batchOps: Operation[] = [];

        // Update the dragged item's parent if changed
        if (originalParent !== newParentId) {
            batchOps.push({
                type: 'UPDATE',
                taskId: draggedId,
                prevUpdateSnapshot: { parentId: originalParent },
                newUpdateSnapshot: { parentId: newParentId }
            });
            await db.tasks.update(draggedId, { parentId: newParentId });
        }

        // Re-assign ascending order values to everything in the spliced array
        for (let i = 0; i < listToReorder.length; i++) {
            const task = listToReorder[i];
            // Only update DB/History if order actually changed
            if (task.id === draggedId && originalOrder !== i) {
                batchOps.push({
                    type: 'UPDATE', taskId: task.id,
                    prevUpdateSnapshot: { order: originalOrder },
                    newUpdateSnapshot: { order: i }
                });
                await db.tasks.update(task.id, { order: i });
            } else if (task.id !== draggedId && task.order !== i) {
                batchOps.push({
                    type: 'UPDATE', taskId: task.id,
                    prevUpdateSnapshot: { order: task.order },
                    newUpdateSnapshot: { order: i }
                });
                await db.tasks.update(task.id, { order: i });
            }
        }

        if (batchOps.length > 0) {
            history.push({ type: 'BATCH', batchOperations: batchOps });
        }
    },

    async getAllTags() {
        const tasks = await db.tasks.toArray();
        const tags = new Set<string>();
        for (const task of tasks) {
            for (const tag of task.tags) {
                tags.add(tag);
            }
        }
        return Array.from(tags).sort();
    }
};
