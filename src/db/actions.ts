import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch
} from "firebase/firestore";
import { db, auth, type Task } from './db';
import { history, type Operation } from './history';

const generateId = () => crypto.randomUUID();

const getUserId = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User not authenticated");
    return uid;
};

const getTasksCollection = () => {
    const uid = getUserId();
    return collection(db, "users", uid, "tasks");
};

export const actions = {
    async addTask(
        text: string,
        parentId: string = 'root',
        tags: string[] = [],
        dueDate: string | null = null,
        insertAfterOrder?: number
    ) {
        const uid = getUserId();
        const tasksRef = getTasksCollection();
        let orderToUse: number;

        // Find siblings
        const q = query(tasksRef, where("parentId", "==", parentId));
        const querySnapshot = await getDocs(q);
        const siblings = querySnapshot.docs.map(d => d.data() as Task);

        const batchOps: Operation[] = [];
        const fbatch = writeBatch(db);

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
                const sibRef = doc(tasksRef, sib.id);
                fbatch.update(sibRef, { order: newOrder });
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
            sectionOrder: Date.now(),
            isFocused: false,
            focusOrder: 0,
            createdAt: Date.now(),
            userId: uid
        };

        batchOps.push({ type: 'ADD', taskId: newTask.id, taskSnapshot: newTask });
        const newRef = doc(tasksRef, newTask.id);
        fbatch.set(newRef, newTask);

        await fbatch.commit();
        history.push({ type: 'BATCH', batchOperations: batchOps });
        return newTask;
    },

    async updateTask(id: string, updates: Partial<Task>) {
        const tasksRef = getTasksCollection();
        const taskRef = doc(tasksRef, id);
        const snap = await getDoc(taskRef);

        if (!snap.exists()) return;
        const existing = snap.data() as Task;

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

        await updateDoc(taskRef, updates);
    },

    async toggleTaskCompletion(id: string, completed: boolean) {
        return this.updateTask(id, { completed });
    },

    async deleteTask(id: string) {
        const tasksRef = getTasksCollection();
        const toDeleteIds = [id];
        let index = 0;

        // BFS to find all children recursively
        while (index < toDeleteIds.length) {
            const currentId = toDeleteIds[index];
            const q = query(tasksRef, where("parentId", "==", currentId));
            const querySnapshot = await getDocs(q);
            for (const childDoc of querySnapshot.docs) {
                toDeleteIds.push(childDoc.id);
            }
            index++;
        }

        const batchOps: Operation[] = [];
        const fbatch = writeBatch(db);

        // Firebase where 'in' max is 10, so fetch each snapshot individually for history
        for (const delId of toDeleteIds) {
            const docRef = doc(tasksRef, delId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                batchOps.push({
                    type: 'DELETE',
                    taskId: delId,
                    taskSnapshot: snap.data() as Task
                });
                fbatch.delete(docRef);
            }
        }

        history.push({ type: 'BATCH', batchOperations: batchOps });
        await fbatch.commit();
    },

    async reorderSiblings(draggedId: string, newParentId: string, dropIndex: number) {
        const tasksRef = getTasksCollection();
        const draggedRef = doc(tasksRef, draggedId);
        const snap = await getDoc(draggedRef);
        if (!snap.exists()) return;

        const draggedTask = snap.data() as Task;
        const originalParent = draggedTask.parentId;
        const originalOrder = draggedTask.order;

        const q = query(tasksRef, where("parentId", "==", newParentId));
        const querySnapshot = await getDocs(q);
        const targetSiblings = querySnapshot.docs.map(d => d.data() as Task);

        const listToReorder = targetSiblings
            .filter(t => t.id !== draggedId)
            .sort((a, b) => a.order - b.order);

        listToReorder.splice(dropIndex, 0, draggedTask);

        const batchOps: Operation[] = [];
        const fbatch = writeBatch(db);

        if (originalParent !== newParentId) {
            batchOps.push({
                type: 'UPDATE',
                taskId: draggedId,
                prevUpdateSnapshot: { parentId: originalParent },
                newUpdateSnapshot: { parentId: newParentId }
            });
            fbatch.update(draggedRef, { parentId: newParentId });
        }

        for (let i = 0; i < listToReorder.length; i++) {
            const task = listToReorder[i];
            if (task.id === draggedId && originalOrder !== i) {
                batchOps.push({
                    type: 'UPDATE', taskId: task.id,
                    prevUpdateSnapshot: { order: originalOrder },
                    newUpdateSnapshot: { order: i }
                });
                fbatch.update(doc(tasksRef, task.id), { order: i });
            } else if (task.id !== draggedId && task.order !== i) {
                batchOps.push({
                    type: 'UPDATE', taskId: task.id,
                    prevUpdateSnapshot: { order: task.order },
                    newUpdateSnapshot: { order: i }
                });
                fbatch.update(doc(tasksRef, task.id), { order: i });
            }
        }

        if (batchOps.length > 0) {
            history.push({ type: 'BATCH', batchOperations: batchOps });
            await fbatch.commit();
        }
    },

    async reorderInSection(draggedId: string, targetDate: string | null, dropIndex: number) {
        const tasksRef = getTasksCollection();
        const draggedRef = doc(tasksRef, draggedId);
        const snap = await getDoc(draggedRef);
        if (!snap.exists()) return;
        const draggedTask = snap.data() as Task;

        let targetTasks: Task[] = [];
        if (targetDate) {
            // Need all tasks to filter appropriately or simplify query
            // Let's just fetch all and filter in memory to keep behavior identical
            const allSnap = await getDocs(tasksRef);
            targetTasks = allSnap.docs.map(d => d.data() as Task).filter(t => t.dueDate === targetDate);
        } else {
            // Null or empty
            const allSnap = await getDocs(tasksRef);
            targetTasks = allSnap.docs.map(d => d.data() as Task).filter(t => !t.dueDate);
        }

        const listToReorder = targetTasks
            .filter(t => t.id !== draggedId)
            .sort((a, b) => (a.sectionOrder || 0) - (b.sectionOrder || 0));

        listToReorder.splice(dropIndex, 0, draggedTask);

        const batchOps: Operation[] = [];
        const fbatch = writeBatch(db);

        for (let i = 0; i < listToReorder.length; i++) {
            const task = listToReorder[i];
            if (task.sectionOrder !== i) {
                batchOps.push({
                    type: 'UPDATE', taskId: task.id,
                    prevUpdateSnapshot: { sectionOrder: task.sectionOrder },
                    newUpdateSnapshot: { sectionOrder: i }
                });
                fbatch.update(doc(tasksRef, task.id), { sectionOrder: i });
            }
        }

        if (batchOps.length > 0) {
            history.push({ type: 'BATCH', batchOperations: batchOps });
            await fbatch.commit();
        }
    },

    async toggleFocus(id: string, isFocused: boolean) {
        const updates: Partial<Task> = { isFocused };
        if (isFocused) {
            updates.focusOrder = Date.now();
        }
        return this.updateTask(id, updates);
    },

    async reorderInFocus(draggedId: string, dropIndex: number) {
        const tasksRef = getTasksCollection();
        const draggedRef = doc(tasksRef, draggedId);
        const snap = await getDoc(draggedRef);
        if (!snap.exists()) return;
        const draggedTask = snap.data() as Task;

        const q = query(tasksRef, where("isFocused", "==", true));
        const allSnap = await getDocs(q);
        const targetTasks = allSnap.docs.map(d => d.data() as Task);

        const listToReorder = targetTasks
            .filter(t => t.id !== draggedId)
            .sort((a, b) => (a.focusOrder || 0) - (b.focusOrder || 0));

        listToReorder.splice(dropIndex, 0, draggedTask);

        const batchOps: Operation[] = [];
        const fbatch = writeBatch(db);

        for (let i = 0; i < listToReorder.length; i++) {
            const task = listToReorder[i];
            if (task.focusOrder !== i) {
                batchOps.push({
                    type: 'UPDATE', taskId: task.id,
                    prevUpdateSnapshot: { focusOrder: task.focusOrder },
                    newUpdateSnapshot: { focusOrder: i }
                });
                fbatch.update(doc(tasksRef, task.id), { focusOrder: i });
            }
        }

        if (batchOps.length > 0) {
            history.push({ type: 'BATCH', batchOperations: batchOps });
            await fbatch.commit();
        }
    },

    async getAllTags() {
        // Need to catch errors here if user is not logged in since sidebar renders immediately
        try {
            const tasksRef = getTasksCollection();
            const allSnap = await getDocs(tasksRef);
            const tags = new Set<string>();
            allSnap.docs.forEach(d => {
                const task = d.data() as Task;
                (task.tags || []).forEach(tag => tags.add(tag));
            });
            return Array.from(tags).sort();
        } catch (e) {
            return [];
        }
    }
};
