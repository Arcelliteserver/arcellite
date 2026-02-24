import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, placeholder = 'Search…' }) => {
  return (
    <div role="search" aria-label="Search files" className="relative w-full group">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-[#5D5FEF] transition-colors pointer-events-none" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-gray-200 hover:border-gray-300 focus:border-[#5D5FEF]/40 focus:ring-2 focus:ring-[#5D5FEF]/10 text-[13px] text-gray-800 placeholder:text-gray-400 outline-none transition-all shadow-sm"
      />
    </div>
  );
};

export default SearchBar;

