'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkCheck, Trash2, Star, ChevronDown } from 'lucide-react';
import { savedViewsApi, SavedView } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/hooks/use-toast';

interface SavedViewsToolbarProps {
  page: string;
  currentFilters: Record<string, unknown>;
  onLoadView: (filters: Record<string, unknown>) => void;
}

export function SavedViewsToolbar({ page, currentFilters, onLoadView }: SavedViewsToolbarProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: views = [] } = useQuery({
    queryKey: ['saved-views', page],
    queryFn: () => savedViewsApi.list(page),
  });

  const { mutate: saveView } = useMutation({
    mutationFn: () => savedViewsApi.save({ page, name: saveName, filters: currentFilters }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-views', page] });
      setSaveName('');
      setSaving(false);
      toast({ title: 'View saved' });
    },
  });

  const { mutate: deleteView } = useMutation({
    mutationFn: (id: string) => savedViewsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views', page] }),
  });

  const { mutate: setDefault } = useMutation({
    mutationFn: (id: string) => savedViewsApi.setDefault(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-views', page] }),
  });

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5"
      >
        <Bookmark className="h-3.5 w-3.5" />
        Views
        {views.length > 0 && (
          <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {views.length}
          </span>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-border bg-popover shadow-lg p-2 space-y-1 animate-fade-in">
            {views.map((v: SavedView) => (
              <div
                key={v.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent group cursor-pointer"
                onClick={() => { onLoadView(v.filters); setOpen(false); }}
              >
                {v.isDefault && <BookmarkCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                {!v.isDefault && <Bookmark className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                <span className="flex-1 text-sm truncate">{v.name}</span>
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDefault(v.id); }}
                    className="p-0.5 rounded hover:text-primary text-muted-foreground"
                    title="Set as default"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteView(v.id); }}
                    className="p-0.5 rounded hover:text-destructive text-muted-foreground"
                    title="Delete view"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {views.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No saved views yet</p>
            )}

            <div className="border-t border-border pt-2 mt-1">
              {saving ? (
                <div className="flex gap-1.5">
                  <Input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="View name…"
                    className="h-7 text-xs flex-1"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter' && saveName.trim()) saveView(); if (e.key === 'Escape') { setSaving(false); setSaveName(''); } }}
                  />
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => saveName.trim() && saveView()} disabled={!saveName.trim()}>
                    Save
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => setSaving(true)}>
                  + Save current filters
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
