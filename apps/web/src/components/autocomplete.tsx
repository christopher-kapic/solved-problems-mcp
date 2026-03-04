"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, X } from "lucide-react";

export interface AutocompleteOption {
  value: string;
  label: string;
}

interface AutocompleteProps {
  value: string;
  displayValue: string;
  onSelect: (option: AutocompleteOption) => void;
  onClear: () => void;
  fetchOptions: (
    query: string,
    signal: AbortSignal
  ) => Promise<AutocompleteOption[]>;
  placeholder?: string;
  className?: string;
}

export function Autocomplete({
  value,
  displayValue,
  onSelect,
  onClear,
  fetchOptions,
  placeholder = "Search...",
  className,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const search = useCallback(
    (q: string) => {
      clearTimeout(debounceRef.current ?? undefined);
      if (abortRef.current) abortRef.current.abort();
      if (!q.trim()) {
        setOptions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        abortRef.current = new AbortController();
        try {
          const results = await fetchOptions(q, abortRef.current!.signal);
          setOptions(results);
        } catch (e) {
          if ((e as Error).name !== "AbortError") {
            setOptions([]);
          }
        } finally {
          setLoading(false);
        }
      }, 200);
    },
    [fetchOptions]
  );

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current ?? undefined);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleSelect = (option: AutocompleteOption) => {
    onSelect(option);
    setQuery("");
    setOptions([]);
    setOpen(false);
  };

  const selected = !!value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className
        )}
      >
        <span
          className={cn(
            "truncate",
            !selected && "text-muted-foreground"
          )}
        >
          {selected ? displayValue : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selected && (
            <button
              type="button"
              className="rounded-sm p-0.5 hover:bg-accent"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="border-b p-1">
            <input
              className="w-full bg-transparent px-1.5 py-1 text-xs outline-none placeholder:text-muted-foreground"
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                search(e.target.value);
              }}
            />
          </div>
          <CommandList>
            {loading && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Loading...
              </div>
            )}
            {!loading && query && options.length === 0 && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {!loading && !query && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                Type to search...
              </div>
            )}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option)}
                  data-checked={option.value === value}
                >
                  <span className="truncate">{option.label}</span>
                  <span className="ml-auto truncate text-muted-foreground text-[10px]">
                    {option.value}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
