import React, { useState, useEffect } from 'react';
import { type Task } from '../db/db';
import { actions } from '../db/actions';
import { X, Calendar, FileText, Tag as TagIcon, Hash } from 'lucide-react';
import { format } from 'date-fns';

type Props = {
    taskId: string;
    tasks: Task[];
    onClose: () => void;
};

export const TaskDetailPanel: React.FC<Props> = ({ taskId, tasks, onClose }) => {
    const task = tasks.find(t => t.id === taskId);
    const [newTag, setNewTag] = useState('');
    const [localText, setLocalText] = useState(task?.text || '');
    const [localNotes, setLocalNotes] = useState(task?.notes || '');
    const [isFocusedText, setIsFocusedText] = useState(false);
    const [isFocusedNotes, setIsFocusedNotes] = useState(false);

    useEffect(() => {
        if (task && !isFocusedText) setLocalText(task.text);
    }, [task?.text, isFocusedText]);

    useEffect(() => {
        if (task && !isFocusedNotes) setLocalNotes(task.notes || '');
    }, [task?.notes, isFocusedNotes]);

    if (!task) return null;

    const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && newTag.trim()) {
            e.preventDefault();
            if (!task.tags?.includes(newTag.trim())) {
                actions.updateTask(task.id, { tags: [...(task.tags || []), newTag.trim()] });
            }
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        actions.updateTask(task.id, { tags: task.tags.filter(t => t !== tagToRemove) });
    };

    return (
        <div className="w-80 h-full border-l border-theme-glass-border bg-theme-glass-solid flex-shrink-0 z-10 flex flex-col relative animate-in slide-in-from-right-8 overflow-y-auto">
            <div className="sticky top-0 bg-theme-glass-solid backdrop-blur-md z-20 border-b border-theme-border px-4 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-theme-text-inv flex items-center gap-2">
                    <Hash size={18} className="text-theme-muted" />
                    Task Details
                </h2>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-theme-muted hover:bg-theme-hover hover:text-theme-text transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="p-5 flex flex-col gap-6">
                <div>
                    <h3 className="text-sm font-semibold text-theme-text mb-1">Title</h3>
                    <input
                        type="text"
                        value={localText}
                        onChange={(e) => {
                            setLocalText(e.target.value);
                            actions.updateTask(task.id, { text: e.target.value });
                        }}
                        onFocus={() => setIsFocusedText(true)}
                        onBlur={() => setIsFocusedText(false)}
                        className="w-full bg-theme-input-bg border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-accent transition-all"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-theme-text">
                        <Calendar size={16} className="text-theme-accent" /> Due Date
                    </div>
                    <input
                        type="date"
                        value={task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : ''}
                        onChange={(e) => actions.updateTask(task.id, { dueDate: e.target.value || null })}
                        className="w-full bg-theme-input-bg border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-accent transition-all"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-theme-text">
                        <FileText size={16} className="text-emerald-500" /> Notes
                    </div>
                    <textarea
                        value={localNotes}
                        onChange={(e) => {
                            setLocalNotes(e.target.value);
                            actions.updateTask(task.id, { notes: e.target.value });
                        }}
                        onFocus={() => setIsFocusedNotes(true)}
                        onBlur={() => setIsFocusedNotes(false)}
                        placeholder="Add task notes here..."
                        rows={4}
                        className="w-full bg-theme-input-bg border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-accent transition-all resize-y"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-theme-text">
                        <TagIcon size={16} className="text-blue-400" /> Tags
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                        {task.tags?.map(tag => (
                            <span key={tag} className="flex items-center gap-1 bg-theme-accent-bg text-theme-accent px-2.5 py-1 rounded-lg text-xs font-semibold border border-theme-accent shadow-sm">
                                {tag}
                                <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-400 ml-1">
                                    <X size={12} strokeWidth={3} />
                                </button>
                            </span>
                        ))}
                    </div>
                    <input
                        type="text"
                        placeholder="Add tag and press Enter"
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        onKeyDown={handleAddTag}
                        className="w-full bg-theme-input-bg border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-accent transition-all placeholder:text-theme-muted"
                    />
                </div>
            </div>
        </div>
    );
};
