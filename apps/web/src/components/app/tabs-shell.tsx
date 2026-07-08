'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TabItem {
  id: string;
  label: string;
  /** Optional badge/count displayed next to the label */
  badge?: number | string;
  /** Disable this tab */
  disabled?: boolean;
}

interface TabsShellProps {
  tabs: TabItem[];
  /** Controlled active tab id */
  activeTab?: string;
  /** Uncontrolled default tab id (first tab if not set) */
  defaultTab?: string;
  /** Fires when the user clicks a tab */
  onTabChange?: (id: string) => void;
  /** Content rendered for each tab identified by its id */
  children: React.ReactNode;
  className?: string;
}

// ─── TabsShell ────────────────────────────────────────────────────────────────

/**
 * Pure UI component for tabbed navigation inside modals.
 * No domain logic, no API calls.
 * Supports both controlled and uncontrolled patterns.
 */
export function TabsShell({
  tabs,
  activeTab: controlledTab,
  defaultTab,
  onTabChange,
  children,
  className,
}: TabsShellProps) {
  const [internalTab, setInternalTab] = useState(defaultTab ?? tabs[0]?.id ?? '');
  const activeId = controlledTab ?? internalTab;

  function handleClick(id: string) {
    if (!controlledTab) {
      setInternalTab(id);
    }
    onTabChange?.(id);
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Tab bar — never scrolls */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-100 px-4 sm:px-6">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => handleClick(tab.id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-xs font-semibold border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200',
                tab.disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
              )}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold',
                    isActive
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-500',
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

// ─── TabPanel ─────────────────────────────────────────────────────────────────

interface TabPanelProps {
  id: string;
  activeId: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Renders content only when its id matches activeId.
 * Use inside TabsShell children to associate content with each tab.
 */
export function TabPanel({ id, activeId, children, className }: TabPanelProps) {
  if (id !== activeId) return null;
  return <div className={cn('p-6', className)}>{children}</div>;
}
