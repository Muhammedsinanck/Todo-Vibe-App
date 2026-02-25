import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { history } from './db/history';
import { TaskTree, type TaskTreeHandle } from './components/TaskTree';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { useTasks, type SectionFilter } from './db/hooks';
import { ListTodo, Calendar, Clock, Archive, Search, Target, Plus } from 'lucide-react';
import './index.css';

function App() {
  const [filter, setFilter] = useState<SectionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [theme, setTheme] = useState<'light' | 'twilight' | 'midnight'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'twilight' | 'midnight') || 'midnight';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(() => {
    const saved = localStorage.getItem('containerWidth');
    return saved ? parseInt(saved, 10) : 896; // 896px = max-w-4xl
  });
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const saved = localStorage.getItem('rightPanelWidth');
    return saved ? parseInt(saved, 10) : 320; // default w-80 (320px)
  });
  const tasks = useTasks(filter, statusFilter);
  const taskTreeRef = useRef<TaskTreeHandle>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('containerWidth', containerWidth.toString());
  }, [containerWidth]);

  useEffect(() => {
    localStorage.setItem('rightPanelWidth', rightPanelWidth.toString());
  }, [rightPanelWidth]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea (browser handles native undo there)
      const activeElement = document.activeElement;
      const isTyping = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      if (!isTyping) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          history.undo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          e.preventDefault();
          history.redo();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const getHeader = () => {
    switch (filter) {
      case 'focus': return { title: 'Focus Priority', icon: <Target className="text-teal-500" /> };
      case 'today': return { title: 'Today', icon: <Calendar className="text-emerald-400" /> };
      case 'upcoming': return { title: 'Upcoming', icon: <Clock className="text-blue-400" /> };
      case 'past': return { title: 'Past & Completed', icon: <Archive className="text-orange-400" /> };
      case 'all': return { title: 'Inbox', icon: <ListTodo className="text-purple-400" /> };
      default: return { title: 'Filtered', icon: <ListTodo /> };
    }
  };

  const header = getHeader();

  return (
    <div className="flex h-screen text-theme-text font-sans overflow-hidden">
      <Sidebar
        currentFilter={filter}
        onFilterChange={setFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        theme={theme}
        onThemeChange={setTheme}
      />

      <main className="flex-1 flex flex-col items-center">
        <div
          className="w-full h-full flex flex-col pt-12 pb-8 px-6 relative"
          style={{ maxWidth: `${containerWidth}px` }}
        >
          {/* Resize Handle */}
          <div
            className="absolute top-1/2 -right-4 w-6 h-20 -translate-y-1/2 cursor-col-resize flex flex-col items-center justify-center hover:bg-theme-hover rounded-full z-50 group transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = containerWidth;

              const onMouseMove = (moveEvent: MouseEvent) => {
                const dx = moveEvent.clientX - startX;
                // Double dx because the container is centered (expanding both ways uniformly)
                let newWidth = startWidth + dx * 2;
                if (newWidth < 500) newWidth = 500;
                if (newWidth > window.innerWidth - 100) newWidth = window.innerWidth - 100;
                setContainerWidth(newWidth);
              };

              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
              };

              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            }}
          >
            <div className="w-1 h-10 bg-theme-border group-hover:bg-theme-accent rounded-full transition-colors shadow-sm" />
          </div>

          <header className="mb-8 flex items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-theme-glass backdrop-blur-sm rounded-xl shadow-sm border border-theme-glass-border">
                {header.icon}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-theme-text-inv">
                  {header.title}
                </h1>
                <p className="text-sm text-theme-muted mt-1 font-medium">
                  {tasks?.length || 0} tasks
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full max-w-md justify-end">
              <button
                onClick={() => taskTreeRef.current?.addRootTask()}
                className="flex items-center gap-2 px-4 py-2 bg-theme-accent hover:bg-theme-accent-hover text-white rounded-xl font-medium transition-colors shadow-sm whitespace-nowrap"
              >
                <Plus size={18} />
                <span>Add Task</span>
              </button>
              <div className="relative max-w-xs w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-theme-muted" />
                </div>
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-theme-glass-border rounded-xl leading-5 bg-theme-input-bg backdrop-blur-sm placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-theme-accent focus:border-transparent focus:bg-theme-glass-solid sm:text-sm transition-all shadow-sm text-theme-text"
                />
              </div>
            </div>
          </header>

          <div className="flex-1 glass-panel overflow-hidden backdrop-blur-2xl flex relative">
            {tasks === undefined ? (
              <div className="w-full h-full flex items-center justify-center text-theme-muted">
                Loading database...
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <TaskTree
                  ref={taskTreeRef}
                  tasks={tasks}
                  isInbox={filter === 'all'}
                  isFocusMode={filter === 'focus'}
                  searchQuery={searchQuery}
                  onClearSearch={() => setSearchQuery('')}
                  selectedTaskId={selectedTaskId}
                  setSelectedTaskId={setSelectedTaskId}
                />
              </div>
            )}

            {/* Right Panel Wrapper */}
            {selectedTaskId && tasks && (
              <>
                <div
                  className="w-1.5 cursor-col-resize hover:bg-theme-accent bg-theme-glass-border/30 transition-colors z-20 flex-shrink-0"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = rightPanelWidth;

                    const onMouseMove = (moveEvent: MouseEvent) => {
                      const dx = startX - moveEvent.clientX; // moving left increases right panel width
                      let newWidth = startWidth + dx;
                      if (newWidth < 250) newWidth = 250;
                      if (newWidth > 600) newWidth = 600;
                      setRightPanelWidth(newWidth);
                    };

                    const onMouseUp = () => {
                      document.removeEventListener('mousemove', onMouseMove);
                      document.removeEventListener('mouseup', onMouseUp);
                    };

                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                  }}
                />
                <div
                  style={{ width: `${rightPanelWidth}px` }}
                  className="h-full border-l border-theme-glass-border bg-theme-glass-solid flex-shrink-0 z-10 animate-in slide-in-from-right-8"
                >
                  <TaskDetailPanel
                    taskId={selectedTaskId}
                    tasks={tasks}
                    onClose={() => setSelectedTaskId(null)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
