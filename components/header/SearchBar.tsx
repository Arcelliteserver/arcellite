import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, placeholder = 'Search assets...' }) => {
  return (
    <div role="search" aria-label="Search files" className="flex-1 max-w-md md:max-w-xl lg:max-w-2xl mx-2 md:mx-8 lg:mx-12 relative flex items-center gap-2 md:gap-3 lg:gap-5">
      <div className="relative flex-1 group min-w-0">
        <Search className="absolute left-2.5 sm:left-3 md:left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 group-focus-within:text-[#5D5FEF] transition-colors flex-shrink-0" />
        <input 
          type="text" 
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-9 sm:pl-10 md:pl-12 pr-6 sm:pr-8 md:pr-12 py-2 sm:py-2.5 md:py-3 bg-[#F5F5F7] rounded-lg sm:rounded-xl md:rounded-2xl border-none focus:ring-2 focus:ring-[#5D5FEF]/10 transition-all text-xs sm:text-sm md:text-[15px] outline-none placeholder:text-gray-400"
        />
      </div>
    </div>
  );
};

export default SearchBar;

