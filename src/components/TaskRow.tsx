import React, { useState, useEffect, useRef } from 'react';
import { type Task } from '../db/db';
import { actions } from '../db/actions';
import { Check, ChevronRight, GripVertical, Trash2, Calendar, Tag as TagIcon, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';

type TaskRowProps = {
    task: Task;
    depth: number;
    isOpen: boolean;
    hasChildren: boolean;
    onToggle: () => void;
    onTaskFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onUpdateText: (id: string, text: string) => void;
    autoFocusId: string | null;
    onAutoFocusComplete: () => void;
    isSelected: boolean;
    onSelect: () => void;
    children?: React.ReactNode;

    // Drag & Drop
    draggedTaskId: string | null;
    setDraggedTaskId: (id: string | null) => void;
    dropTargetId: string | null;
    setDropTargetId: (id: string | null) => void;
    dropPosition: 'before' | 'after' | 'inside' | null;
    setDropPosition: (pos: 'before' | 'after' | 'inside' | null) => void;
    onDrop: (e: React.DragEvent) => void;
};

export const TaskRow: React.FC<TaskRowProps> = ({
    task, depth, isOpen, hasChildren, onToggle,
    onKeyDown, onTaskFocus, onUpdateText,
    autoFocusId, onAutoFocusComplete, isSelected, onSelect,
    children, draggedTaskId, setDraggedTaskId, dropTargetId, setDropTargetId, dropPosition, setDropPosition, onDrop
}) => {
    const [localText, setLocalText] = useState(task.text);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);

    // Sync local text when not focused to prevent cursor jumping on async updates
    useEffect(() => {
        if (!isFocused) {
            setLocalText(task.text);
        }
    }, [task.text, isFocused]);

    // Auto-focus logic when task is newly created
    useEffect(() => {
        if (autoFocusId === task.id && inputRef.current) {
            inputRef.current.focus();
            onAutoFocusComplete();
        }
    }, [autoFocusId, task.id, onAutoFocusComplete]);

    const handleToggleCompleted = () => {
        actions.toggleTaskCompletion(task.id, !task.completed);
    };

    const handleDelete = () => {
        actions.deleteTask(task.id);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {

        onKeyDown(e);
    };

    const handleDragStart = (e: React.DragEvent) => {
        setDraggedTaskId(task.id);
        e.dataTransfer.effectAllowed = 'move';
        // Hide the ghost image if possible, or leave default
        setTimeout(() => {
            if (rowRef.current) rowRef.current.style.opacity = '0.4';
        }, 0);
    };

    const handleDragEnd = (_e: React.DragEvent) => {
        if (rowRef.current) rowRef.current.style.opacity = '1';
        setDraggedTaskId(null);
        setDropTargetId(null);
        setDropPosition(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (draggedTaskId === task.id) return;

        if (!rowRef.current) return;
        const rect = rowRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;

        let pos: 'before' | 'after' | 'inside' = 'inside';
        const height = rect.height;

        if (y < height * 0.25) pos = 'before';
        else if (y > height * 0.75) pos = 'after';

        setDropTargetId(task.id);
        setDropPosition(pos);
    };

    const isDropTarget = dropTargetId === task.id;

    return (
        <div className="w-full flex flex-col relative" onClick={(e) => {
            e.stopPropagation();
            onSelect();
        }}>
            {/* Drop Indicator Before */}
            {isDropTarget && dropPosition === 'before' && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-purple-500 z-10 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)] transform -translate-y-1/2" style={{ marginLeft: `${depth * 24 + 12}px` }} />
            )}

            <div
                ref={rowRef}
                draggable
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={onDrop}
                className={clsx(
                    "group flex items-center py-2 px-3 rounded-xl transition-all w-full border backdrop-blur-sm",
                    isSelected
                        ? "bg-theme-accent-bg border-theme-accent shadow-[0_2px_10px_rgba(168,85,247,0.1)]"
                        : "border-transparent hover:bg-theme-hover hover:border-theme-border hover:shadow-sm",
                    task.completed && "opacity-60",
                    isDropTarget && dropPosition === 'inside' && "bg-theme-accent-hover border-theme-accent outline outline-2 outline-theme-accent"
                )}
                style={{ paddingLeft: `${depth * 24 + 12}px` }}
            >
                <div className="flex-none flex items-center justify-center w-6 h-6 mr-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-theme-muted hover:text-theme-text transition-opacity">
                    <GripVertical size={16} />
                </div>

                <div
                    className={clsx(
                        "flex-none flex items-center justify-center w-6 h-6 cursor-pointer mr-2 transition-transform",
                        isOpen ? "rotate-90" : "rotate-0"
                    )}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                    }}
                    style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
                >
                    <ChevronRight size={18} className="text-theme-muted" />
                </div>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleToggleCompleted();
                    }}
                    className={clsx(
                        "flex-none w-5 h-5 rounded-[6px] border-[2px] flex items-center justify-center transition-all mr-3 shadow-sm",
                        task.completed
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "bg-theme-input-bg border-theme-border hover:border-emerald-500"
                    )}
                >
                    {task.completed && <Check size={12} strokeWidth={3} />}
                </button>

                <div className="flex-1 flex flex-col justify-center min-w-0">
                    <input
                        ref={inputRef}
                        type="text"
                        value={localText}
                        onChange={(e) => {
                            setLocalText(e.target.value);
                            onUpdateText(task.id, e.target.value);
                        }}
                        onKeyDown={handleInputKeyDown}
                        onFocus={(e) => {
                            setIsFocused(true);
                            onTaskFocus(e);
                            onSelect();
                        }}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Empty task..."
                        className={clsx(
                            "task-row-input w-full bg-transparent border-none outline-none text-[15px] font-medium transition-colors placeholder:text-theme-muted",
                            task.completed ? "line-through text-theme-muted" : "text-theme-text"
                        )}
                    />

                    {(task.tags?.length > 0 || task.notes) && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-theme-muted font-medium">
                            {task.notes && (
                                <span className="flex items-center gap-1 bg-theme-input-bg px-1.5 py-0.5 rounded-md text-emerald-500">
                                    <FileText size={12} /> Notes
                                </span>
                            )}
                            {task.tags?.map((tag) => (
                                <span key={tag} className="flex items-center gap-1 bg-theme-input-bg px-1.5 py-0.5 rounded-md border border-theme-border text-blue-400">
                                    <TagIcon size={10} /> {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {task.dueDate && (
                    <div className="flex-none flex items-center mr-2 text-xs font-semibold text-theme-accent bg-theme-accent-bg border border-theme-accent shadow-sm px-2 py-1 rounded-lg">
                        {format(new Date(task.dueDate), 'MMM d')}
                    </div>
                )}

                <div className={clsx(
                    "flex-none flex items-center transition-opacity ml-2 gap-1 opacity-0 group-hover:opacity-100"
                )}>
                    <div className="relative w-8 h-8 flex items-center justify-center p-1.5 rounded-lg text-theme-muted hover:text-theme-text hover:bg-theme-hover shadow-sm transition-colors" title="Set Due Date">
                        <Calendar size={16} />
                        <input
                            type="date"
                            value={task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : ''}
                            onChange={(e) => actions.updateTask(task.id, { dueDate: e.target.value || null })}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer outline-none"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete();
                        }}
                        className="p-1.5 text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shadow-sm"
                        title="Delete (Select Row + Del)"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Drop Indicator After */}
            {isDropTarget && dropPosition === 'after' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 z-10 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)] transform translate-y-1/2" style={{ marginLeft: `${depth * 24 + 12}px` }} />
            )}



            {/* Render children right below the TaskRow */}
            {children}

        </div>
    );
};
