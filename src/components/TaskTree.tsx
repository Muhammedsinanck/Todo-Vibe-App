import React, { useState, useEffect } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { TaskRow } from './TaskRow';
import { type Task } from '../db/db';
import { actions } from '../db/actions';

type Props = {
    tasks: Task[];
    isInbox?: boolean;
    searchQuery?: string;
    selectedTaskId: string | null;
    setSelectedTaskId: (id: string | null) => void;
};

export type TreeNode = {
    task: Task;
    children: TreeNode[];
};

export const TaskTree: React.FC<Props> = ({ tasks, isInbox, searchQuery = '', selectedTaskId, setSelectedTaskId }) => {
    const [openIds, setOpenIds] = useState<Set<string>>(new Set(['group-past', 'group-today', 'group-upcoming', 'group-nodate']));
    const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

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
    const nodeMap = new Map<string, TreeNode>();

    // Apply Search Filtering first
    let filteredTasks = tasks;
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchingIds = new Set<string>();
        tasks.forEach(task => {
            if (task.text.toLowerCase().includes(query) ||
                task.notes?.toLowerCase().includes(query) ||
                task.tags?.some(tag => tag.toLowerCase().includes(query))) {
                matchingIds.add(task.id);
            }
        });

        const idsToKeep = new Set(matchingIds);
        let addedNew = true;
        while (addedNew) {
            addedNew = false;
            tasks.forEach(task => {
                if (idsToKeep.has(task.id) && task.parentId !== 'root' && !idsToKeep.has(task.parentId)) {
                    idsToKeep.add(task.parentId);
                    addedNew = true;
                }
            });
        }
        filteredTasks = tasks.filter(t => idsToKeep.has(t.id));
    }

    // 1. Initialize all nodes
    filteredTasks.forEach(task => {
        let parentId = task.parentId;
        if (searchQuery && !filteredTasks.some(t => t.id === parentId)) {
            parentId = 'root'; // Attach to root if parent is filtered out
        }

        nodeMap.set(task.id, {
            task: { ...task, parentId }, // Temp override parentId for rendering
            children: []
        });
    });

    // 2. Build Hierarchy
    nodeMap.forEach(node => {
        if (node.task.parentId !== 'root' && nodeMap.has(node.task.parentId)) {
            nodeMap.get(node.task.parentId)!.children.push(node);
        } else {
            rootNodes.push(node);
        }
    });

    // 3. Sort children based on order
    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => a.task.order - b.task.order);
        nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(rootNodes);


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

        rootNodes.forEach(node => {
            if (!node.task.dueDate) {
                groups.nodate.nodes.push(node);
            } else {
                const due = parseLocal(node.task.dueDate);
                const todayEnd = endOfDay(new Date());
                const todayStart = startOfDay(new Date());

                if (isBefore(due, todayStart)) groups.past.nodes.push(node);
                else if (isAfter(due, todayEnd)) groups.upcoming.nodes.push(node);
                else groups.today.nodes.push(node);
            }
        });
    }

    const toggleOpen = (id: string) => {
        setOpenIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
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

        if (targetId.startsWith('group-')) {
            newParentId = 'root';
            // Just drop at the end of the group
            const groupKey = targetId.replace('group-', '');
            const targetGroup = groups[groupKey];
            if (targetGroup) {
                // Approximate drop index logic - we'll just put it at 0 for now when dropping on a group header
                dropIndex = 0;
            }
            // If dragging to a group, update due date accordingly
            let newDueDate = draggedTask.dueDate;
            if (targetId === 'group-today') newDueDate = new Date().toISOString();
            else if (targetId === 'group-nodate') newDueDate = null;

            if (newDueDate !== draggedTask.dueDate) {
                await actions.updateTask(draggedTaskId, { dueDate: newDueDate });
            }
        } else if (dropTargetId && dropPosition) {
            const targetTask = tasks.find(t => t.id === targetId);
            if (!targetTask) return;

            if (dropPosition === 'inside') {
                newParentId = targetId;
                // Add to bottom of children
                const children = tasks.filter(t => t.parentId === targetId);
                dropIndex = children.length;
            } else {
                newParentId = targetTask.parentId;
                const siblings = tasks.filter(t => t.parentId === newParentId).sort((a, b) => a.order - b.order);
                const targetIndex = siblings.findIndex(t => t.id === targetId);
                dropIndex = dropPosition === 'before' ? targetIndex : targetIndex + 1;
            }
        }

        await actions.reorderSiblings(draggedTaskId, newParentId, dropIndex);

        setDraggedTaskId(null);
        setDropTargetId(null);
        setDropPosition(null);
    };

    const renderNodeList = (nodes: TreeNode[], depth: number) => {
        return nodes.map(node => (
            <TaskRow
                key={node.task.id}
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
                        {renderNodeList(node.children, depth + 1)}
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
                                    {renderNodeList(g.nodes, 0)}
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
};
