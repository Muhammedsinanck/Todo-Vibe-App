import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { startOfDay, endOfDay, isBefore, isAfter, format } from 'date-fns';
import { TaskRow } from './TaskRow';
import { type Task } from '../db/db';
import { actions } from '../db/actions';

type Props = {
    tasks: Task[];
    isInbox?: boolean;
    isFocusMode?: boolean;
    searchQuery?: string;
    onClearSearch?: () => void;
    selectedTaskId: string | null;
    setSelectedTaskId: (id: string | null) => void;
};

export type TreeNode = {
    task: Task;
    children: TreeNode[];
};

// Removed generic tree builder in favor of strict filter

const buildStrictTreeFromMatch = (allTasks: Task[], matchFn: (t: Task) => boolean): TreeNode[] => {
    // 1. Identify true matches
    const matchingIds = new Set<string>();
    allTasks.forEach(task => {
        if (matchFn(task)) matchingIds.add(task.id);
    });

    // 2. Keep ONLY true matches. Exclude ancestors that don't match.
    const keptTasks = allTasks.filter(t => matchingIds.has(t.id));

    const map = new Map<string, TreeNode>();
    keptTasks.forEach(task => {
        let parentId = task.parentId;
        // If the task's parent isn't also a match, hoist it to the root of this section
        if (!matchingIds.has(parentId)) {
            parentId = 'root';
        }
        map.set(task.id, {
            task: { ...task, parentId },
            children: []
        });
    });

    const roots: TreeNode[] = [];
    map.forEach(node => {
        if (node.task.parentId !== 'root' && map.has(node.task.parentId)) {
            map.get(node.task.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    });

    // 3. Sort strictly: Root nodes sort by sectionOrder, children sort by original tree order
    roots.sort((a, b) => (a.task.sectionOrder || 0) - (b.task.sectionOrder || 0));

    const sortChildren = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => a.task.order - b.task.order);
        nodes.forEach(n => sortChildren(n.children));
    };
    roots.forEach(r => sortChildren(r.children));

    return roots;
};

export interface TaskTreeHandle {
    addRootTask: () => Promise<void>;
}

export const TaskTree = forwardRef<TaskTreeHandle, Props>(({
    tasks,
    isInbox,
    isFocusMode,
    searchQuery = '',
    onClearSearch,
    selectedTaskId,
    setSelectedTaskId
}, ref) => {
    const [openIds, setOpenIds] = useState<Set<string>>(new Set(['group-past', 'group-today', 'group-upcoming', 'group-nodate']));
    const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

    useImperativeHandle(ref, () => ({
        addRootTask: async () => {
            const newTask = await actions.addTask('', 'root', [], null, -1);
            const newId = newTask.id;

            // If we are in inbox but not searching, open nodate and focus
            if (isInbox && !searchQuery) {
                setOpenIds(prev => {
                    const next = new Set(prev);
                    next.add('group-nodate');
                    return next;
                });
                setAutoFocusId(`group-nodate_${newId}`);
            } else {
                setAutoFocusId(newId);
            }
            setSelectedTaskId(newId);
        }
    }));

    // Global KeyDown for Task Deletion
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' && selectedTaskId) {
                // Confirm user isn't typing in an input before deleting globally
                const activeElement = document.activeElement;
                const isTyping = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
                if (!isTyping) {
                    actions.deleteTask(selectedTaskId);
                    setSelectedTaskId(null);
                }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [selectedTaskId, setSelectedTaskId]);

    // Build the tree
    let rootNodes: TreeNode[] = [];

    if (isFocusMode) {
        // Pure flat mapping. No parent logic.
        rootNodes = tasks.map(task => ({
            task,
            children: []
        }));
    } else if (searchQuery) {
        const query = searchQuery.toLowerCase();
        // Use strict matching so searching only returns individual matched items at root level
        rootNodes = buildStrictTreeFromMatch(tasks, task =>
            task.text.toLowerCase().includes(query) ||
            (!!task.notes && task.notes.toLowerCase().includes(query)) ||
            (!!task.tags && task.tags.some(tag => tag.toLowerCase().includes(query)))
        );
    } else {
        // If not searching, just build standard full tree. 
        // We can mimic buildTreeFromMatch with a simple loop since matchFn is always true.
        const map = new Map<string, TreeNode>();
        tasks.forEach(task => {
            map.set(task.id, { task, children: [] });
        });

        tasks.forEach(task => {
            const node = map.get(task.id)!;
            if (task.parentId !== 'root' && map.has(task.parentId)) {
                map.get(task.parentId)!.children.push(node);
            } else {
                rootNodes.push(node);
            }
        });

        const sortChildren = (nodes: TreeNode[]) => {
            nodes.sort((a, b) => a.task.order - b.task.order);
            nodes.forEach(n => sortChildren(n.children));
        };
        sortChildren(rootNodes);
    }


    // Grouping
    const groups: Record<string, { id: string; text: string; nodes: TreeNode[] }> = {
        past: { id: 'group-past', text: 'Past', nodes: [] },
        today: { id: 'group-today', text: 'Today', nodes: [] },
        upcoming: { id: 'group-upcoming', text: 'Upcoming', nodes: [] },
        nodate: { id: 'group-nodate', text: 'No Date', nodes: [] },
    };

    if (isInbox && !searchQuery) {
        const parseLocal = (dStr: string) => {
            const parts = dStr.split('-');
            return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        };

        const todayEnd = endOfDay(new Date());
        const todayStart = startOfDay(new Date());

        groups.past.nodes = buildStrictTreeFromMatch(tasks, t => {
            if (!t.dueDate) return false;
            return isBefore(parseLocal(t.dueDate), todayStart);
        });

        groups.today.nodes = buildStrictTreeFromMatch(tasks, t => {
            if (!t.dueDate) return false;
            const due = parseLocal(t.dueDate);
            return !isBefore(due, todayStart) && !isAfter(due, todayEnd);
        });

        groups.upcoming.nodes = buildStrictTreeFromMatch(tasks, t => {
            if (!t.dueDate) return false;
            return isAfter(parseLocal(t.dueDate), todayEnd);
        });

        groups.nodate.nodes = rootNodes;
        groups.nodate.text = 'No Date / All';
    }

    const toggleOpen = (id: string) => {
        setOpenIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDoubleClickToAll = (targetTaskId: string) => {
        if (!isInbox) return;

        if (searchQuery && onClearSearch) {
            onClearSearch();
        }

        setOpenIds(prev => {
            const next = new Set(prev);
            next.add('group-nodate');

            let currentId = targetTaskId;
            while (currentId && currentId !== 'root') {
                next.add(currentId);
                const taskObj = tasks.find(t => t.id === currentId);
                currentId = taskObj?.parentId || 'root';
            }
            return next;
        });

        setSelectedTaskId(targetTaskId);

        // Allow React to mount the expanded No Date nodes before scrolling
        setTimeout(() => {
            const domId = `task-row-group-nodate-${targetTaskId}`;
            const el = document.getElementById(domId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Optional highlight flash
                el.classList.add('ring-2', 'ring-theme-accent', 'ring-offset-2', 'transition-all');
                setTimeout(() => el.classList.remove('ring-2', 'ring-theme-accent', 'ring-offset-2'), 1000);
            }
        }, 150);
    };

    const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, task: Task) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const isSubtask = e.ctrlKey || e.metaKey;

            let parentId = isSubtask ? task.id : task.parentId;
            const insertAfterOrder = isSubtask ? undefined : task.order;

            const newTask = await actions.addTask('', parentId, [], task.dueDate || null, insertAfterOrder);
            setAutoFocusId(newTask.id);

            if (isSubtask && !openIds.has(task.id)) {
                setOpenIds(new Set([...openIds, task.id]));
            }
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            // Complex to implement a flat tree navigation here, we will do basic focus handling inside TaskRow or using DOM traversal
            const rowElements = Array.from(document.querySelectorAll('.task-row-input')) as HTMLInputElement[];
            const idx = rowElements.indexOf(e.currentTarget);
            if (idx !== -1) {
                const targetIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
                if (targetIdx >= 0 && targetIdx < rowElements.length) {
                    rowElements[targetIdx].focus();
                }
            }
        }
    };

    const handleUpdateText = (id: string, text: string) => {
        actions.updateTask(id, { text });
    };

    const handleDrop = async (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!draggedTaskId || draggedTaskId === targetId) return;

        let draggedTask = tasks.find(t => t.id === draggedTaskId);
        if (!draggedTask) return;

        let newParentId = 'root';
        let dropIndex = 0;
        let isSectionDrop = true; // Assume flat section drop unless it involves nodate tree

        let isFocusDrop = false;

        if (isFocusMode) {
            isFocusDrop = true;
            // Target index is exactly the flat array index
            dropIndex = tasks.findIndex(t => t.id === targetId);
            if (dropIndex === -1) dropIndex = tasks.length;
            else if (dropPosition === 'after') dropIndex++;
        } else if (targetId.startsWith('group-')) {
            const groupKey = targetId.replace('group-', '');
            // Dropping on the No-Date group header means putting at root bottom 
            if (groupKey === 'nodate') {
                isSectionDrop = false;
                newParentId = 'root';
                dropIndex = tasks.filter(t => t.parentId === 'root').length;
            } else {
                dropIndex = groups[groupKey]?.nodes?.length || 0;
            }

            // Update due date based on group target
            let newDueDate = draggedTask.dueDate;
            if (targetId === 'group-today') newDueDate = format(new Date(), 'yyyy-MM-dd');
            else if (targetId === 'group-nodate') newDueDate = null;

            if (newDueDate !== draggedTask.dueDate) {
                await actions.updateTask(draggedTaskId, { dueDate: newDueDate });
                draggedTask = { ...draggedTask, dueDate: newDueDate }; // Local update for reorder reference
            }
        } else if (dropTargetId && dropPosition) {
            const targetTask = tasks.find(t => t.id === targetId);
            if (!targetTask) return;

            // Determine if we are interacting with the flat Date sections vs the hierarchical No-Date tree
            // We can infer this by checking if the dropTargetId exists inside the nodate tree
            const isInNoDateTree = (taskId: string): boolean => {
                const checkNode = (nodes: TreeNode[]): boolean => {
                    for (const n of nodes) {
                        if (n.task.id === taskId) return true;
                        if (checkNode(n.children)) return true;
                    }
                    return false;
                };
                return checkNode(groups.nodate.nodes);
            };

            isSectionDrop = !isInNoDateTree(targetId);

            if (isSectionDrop) {
                const targetDate = targetTask.dueDate;
                const parseLocal = (dStr: string) => {
                    const parts = dStr.split('-');
                    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                };

                // Determine flat drop index inside the current date's matching group.
                // Because we strictly filtered the tree, we look only at the top-level nodes of the matched section
                // to find our sectionOrder target index.
                let targetSectionNodes: TreeNode[] = [];
                if (!targetDate) {
                    targetSectionNodes = [];
                } else if (isBefore(parseLocal(targetDate), startOfDay(new Date()))) targetSectionNodes = groups.past.nodes;
                else if (isAfter(parseLocal(targetDate), endOfDay(new Date()))) targetSectionNodes = groups.upcoming.nodes;
                else targetSectionNodes = groups.today.nodes;

                const targetIndex = targetSectionNodes.findIndex(n => n.task.id === targetId);

                // Fallback to end of array if we somehow drop inside a nested matched tree instead of top level
                if (targetIndex === -1) {
                    dropIndex = targetSectionNodes.length;
                } else {
                    dropIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;
                }

                // If dropped into a *different* section's task, we must inherit its date first
                if (draggedTask.dueDate !== targetDate) {
                    await actions.updateTask(draggedTaskId, { dueDate: targetDate });
                    draggedTask = { ...draggedTask, dueDate: targetDate };
                }

            } else {
                // Standard Hierarchical Tree Drop (No Date Area)
                if (dropPosition === 'inside') {
                    newParentId = targetId;
                    const children = tasks.filter(t => t.parentId === targetId);
                    dropIndex = children.length;
                } else {
                    newParentId = targetTask.parentId;
                    const siblings = tasks.filter(t => t.parentId === newParentId).sort((a, b) => a.order - b.order);
                    const targetIndex = siblings.findIndex(t => t.id === targetId);
                    dropIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;
                }
            }
        }

        if (isFocusDrop) {
            await actions.reorderInFocus(draggedTaskId, dropIndex);
        } else if (isSectionDrop) {
            await actions.reorderInSection(draggedTaskId, draggedTask.dueDate, dropIndex);
        } else {
            await actions.reorderSiblings(draggedTaskId, newParentId, dropIndex);
        }

        setDraggedTaskId(null);
        setDropTargetId(null);
        setDropPosition(null);
    };

    const renderNodeList = (nodes: TreeNode[], depth: number, keyPrefix: string = '') => {
        return nodes.map(node => (
            <TaskRow
                key={`${keyPrefix}${node.task.id}`}
                domId={`task-row-${keyPrefix}${node.task.id}`}
                onDoubleClick={() => handleDoubleClickToAll(node.task.id)}
                task={node.task}
                depth={depth}
                isOpen={openIds.has(node.task.id)}
                hasChildren={node.children.length > 0}
                onToggle={() => toggleOpen(node.task.id)}
                onTaskFocus={() => setSelectedTaskId(node.task.id)}
                onKeyDown={(e) => handleKeyDown(e, node.task)}
                onUpdateText={handleUpdateText}
                autoFocusId={autoFocusId}
                onAutoFocusComplete={() => setAutoFocusId(null)}
                isSelected={selectedTaskId === node.task.id}
                onSelect={() => setSelectedTaskId(node.task.id)}

                // Drag and drop props
                draggedTaskId={draggedTaskId}
                setDraggedTaskId={setDraggedTaskId}
                dropTargetId={dropTargetId}
                setDropTargetId={setDropTargetId}
                dropPosition={dropPosition}
                setDropPosition={setDropPosition}
                onDrop={(e) => handleDrop(e, node.task.id)}
            >
                {openIds.has(node.task.id) && node.children.length > 0 && (
                    <div className="flex flex-col">
                        {renderNodeList(node.children, depth + 1, keyPrefix)}
                    </div>
                )}
            </TaskRow>
        ));
    };

    return (
        <div className="w-full h-full flex flex-col gap-1 p-4 overflow-y-auto" onClick={() => setSelectedTaskId(null)}>
            {tasks.length === 0 ? (
                <div className="text-theme-muted italic text-sm text-center py-10">
                    No tasks. Type below to add one.
                </div>
            ) : isInbox && !searchQuery ? (
                <>
                    {Object.values(groups).map(g => (
                        <div key={g.id} className="mb-4">
                            <div
                                className="py-2.5 px-3 mb-2 font-bold text-theme-text text-lg flex items-center gap-2 cursor-pointer hover:bg-theme-hover rounded-lg transition-colors border-b border-theme-border"
                                onClick={(e) => { e.stopPropagation(); toggleOpen(g.id); }}
                                onDragOver={(e) => { e.preventDefault(); setDropTargetId(g.id); setDropPosition('inside'); }}
                                onDrop={(e) => handleDrop(e, g.id)}
                            >
                                <div className={`transition-transform ${openIds.has(g.id) ? 'rotate-90' : ''}`}>
                                    <ChevronRight size={20} className="text-theme-muted" />
                                </div>
                                {g.text}
                            </div>
                            {openIds.has(g.id) && (
                                <div className="flex flex-col">
                                    {renderNodeList(g.nodes, 0, `${g.id}-`)}
                                </div>
                            )}
                        </div>
                    ))}
                </>
            ) : (
                <div className="flex flex-col">
                    {renderNodeList(rootNodes, 0)}
                </div>
            )}

            <button
                onClick={(e) => { e.stopPropagation(); actions.addTask('', 'root'); }}
                className="mt-4 flex items-center justify-center gap-2 text-theme-muted hover:text-theme-text hover:bg-theme-hover border border-theme-glass-border rounded-xl p-3 transition-colors shadow-sm font-medium"
            >
                <Plus size={20} /> Add Task
            </button>
        </div>
    );
});
