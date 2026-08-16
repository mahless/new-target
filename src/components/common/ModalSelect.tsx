import React, { useState, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export interface ModalSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

interface ModalSelectProps {
  id?: string;
  label?: string;
  modalTitle: string;
  modalSubtitle?: string;
  options: ModalSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  buttonClassName?: string;
  searchable?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  helperText?: string;
}

export const ModalSelect: React.FC<ModalSelectProps> = ({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = 'انقر للاختيار...',
  disabled = false,
  required = false,
  className = '',
  buttonClassName = '',
  searchable = true,
  helperText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  const IconComp = selectedOption?.icon;

  return (
    <div className={`w-full relative ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-amber-400">*</span>}
          </span>
        </label>
      )}

      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={`w-full flex items-center justify-between gap-3 bg-slate-950 border ${
          selectedOption ? 'border-slate-700 text-slate-100' : 'border-slate-800 text-slate-400'
        } rounded-xl px-3.5 py-2.5 text-xs text-right transition-all hover:border-amber-500/50 hover:bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <div className="flex items-center gap-2.5 truncate flex-1">
          {IconComp && <IconComp className="w-4 h-4 text-amber-400 shrink-0" />}
          <div className="truncate text-right">
            {selectedOption ? (
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 truncate">{selectedOption.label}</span>
                {selectedOption.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                    {selectedOption.badge}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400">{placeholder}</span>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {helperText && <p className="text-[11px] text-slate-400 mt-1">{helperText}</p>}

      {isOpen && (
        <>
          {/* Click outside overlay */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => {
              setIsOpen(false);
              setSearchQuery('');
            }}
          />

          {/* Absolute Dropdown Panel */}
          <div className="absolute left-0 right-0 z-50 mt-1.5 p-3.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl space-y-3 max-h-[280px] flex flex-col">
            {searchable && options.length > 4 && (
              <div className="relative shrink-0">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()))}
                  placeholder="بحث وتصفية..."
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pr-8 pl-3 py-1.5 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            )}

            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-slate-400 text-xs">
                  لا توجد عناصر مطابقة لبحثك
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  const OptIcon = opt.icon;
                  return (
                    <div
                      key={opt.value}
                      onClick={() => {
                        if (!opt.disabled) handleSelect(opt.value);
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-lg border text-right transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 text-slate-100 shadow-sm'
                          : opt.disabled
                          ? 'bg-slate-950/40 border-slate-800/40 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {OptIcon && (
                          <div
                            className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <OptIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-100">{opt.label}</span>
                            {opt.badge && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          {opt.sublabel && (
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{opt.sublabel}</p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-700 hover:border-slate-500" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
