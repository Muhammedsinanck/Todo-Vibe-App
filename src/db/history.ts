import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth, type Task } from './db';

// History operations definition
// ADD: To undo, we delete. To redo, we add back.
// DELETE: To undo, we add back. To redo, we delete again.
// UPDATE: To undo, apply prev state. To redo, apply new state.
// BATCH: A collection of operations to undo/redo together.

export type OperationType = 'ADD' | 'DELETE' | 'UPDATE' | 'BATCH';

export interface Operation {
    type: OperationType;
    taskId?: string;
    taskSnapshot?: Task;          // Complete task (useful for ADD / DELETE)
    prevUpdateSnapshot?: Partial<Task>; // Just the changed fields (before mutation)
    newUpdateSnapshot?: Partial<Task>;  // Just the changed fields (after mutation)
    batchOperations?: Operation[];      // Collection of sub-operations
}

const MAX_HISTORY = 50;

class HistoryManager {
    private undoStack: Operation[] = [];
    private redoStack: Operation[] = [];
    // Can optionally subscribe UI to changes if we want Undo/Redo buttons to enable/disable
    public listeners: (() => void)[] = [];

    private getDocRef(taskId: string) {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("No authenticated user");
        return doc(db, 'users', uid, 'tasks', taskId);
    }

    push(op: Operation) {
        this.undoStack.push(op);
        if (this.undoStack.length > MAX_HISTORY) {
            this.undoStack.shift();
        }
        // Changing history clears all redos
        this.redoStack = [];
        this.notify();
    }

    async undo() {
        if (this.undoStack.length === 0) return;
        const op = this.undoStack.pop()!;
        await this.applyInverse(op);
        this.redoStack.push(op);
        this.notify();
    }

    async redo() {
        if (this.redoStack.length === 0) return;
        const op = this.redoStack.pop()!;
        await this.applyForward(op);
        this.undoStack.push(op);
        this.notify();
    }

    private async applyInverse(op: Operation) {
        switch (op.type) {
            case 'ADD':
                if (op.taskId) {
                    await deleteDoc(this.getDocRef(op.taskId));
                }
                break;
            case 'DELETE':
                if (op.taskId && op.taskSnapshot) {
                    await setDoc(this.getDocRef(op.taskId), op.taskSnapshot);
                }
                break;
            case 'UPDATE':
                if (op.taskId && op.prevUpdateSnapshot) {
                    await updateDoc(this.getDocRef(op.taskId), op.prevUpdateSnapshot);
                }
                break;
            case 'BATCH':
                if (op.batchOperations) {
                    // Undo must be played back in REVERSE order for safety
                    for (let i = op.batchOperations.length - 1; i >= 0; i--) {
                        await this.applyInverse(op.batchOperations[i]);
                    }
                }
                break;
        }
    }

    private async applyForward(op: Operation) {
        switch (op.type) {
            case 'ADD':
                if (op.taskId && op.taskSnapshot) {
                    await setDoc(this.getDocRef(op.taskId), op.taskSnapshot);
                }
                break;
            case 'DELETE':
                if (op.taskId) {
                    await deleteDoc(this.getDocRef(op.taskId));
                }
                break;
            case 'UPDATE':
                if (op.taskId && op.newUpdateSnapshot) {
                    await updateDoc(this.getDocRef(op.taskId), op.newUpdateSnapshot);
                }
                break;
            case 'BATCH':
                if (op.batchOperations) {
                    // Redo is played back in standard order
                    for (let i = 0; i < op.batchOperations.length; i++) {
                        await this.applyForward(op.batchOperations[i]);
                    }
                }
                break;
        }
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    subscribe(listener: () => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
}

export const history = new HistoryManager();
