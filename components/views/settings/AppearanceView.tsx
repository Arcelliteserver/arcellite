import React, { useState } from 'react';
import { Palette, Moon, Sun, Monitor, Type } from 'lucide-react';

const AppearanceView: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');

  const themes = [
    { id: 'light', icon: Sun, label: 'Light', description: 'Light theme' },
    { id: 'dark', icon: Moon, label: 'Dark', description: 'Dark theme' },
    { id: 'auto', icon: Monitor, label: 'Auto', description: 'Follow system preference' },
  ];

  const fontSizes = [
    { id: 'small', label: 'Small', size: '14px' },
    { id: 'medium', label: 'Medium', size: '16px' },
    { id: 'large', label: 'Large', size: '18px' },
  ];

  return (
    <div className="w-full">
      <div className="mb-10">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            Appearance
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-sm pl-3 sm:pl-4 md:pl-6">Customize the look and feel of your vault</p>
      </div>

      <div className="space-y-8">
        {/* Theme Selection */}
        <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-5 h-5 text-[#5D5FEF]" />
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider text-xs">
              Theme
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {themes.map((themeOption) => {
              const Icon = themeOption.icon;
              const isSelected = theme === themeOption.id;
              return (
                <button
                  key={themeOption.id}
                  onClick={() => setTheme(themeOption.id as 'light' | 'dark' | 'auto')}
                  className={`p-6 rounded-2xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                      : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                  }`}
                >
                  <Icon className={`w-6 h-6 mb-3 ${isSelected ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                  <h3 className="text-[14px] font-black text-gray-900 mb-1">{themeOption.label}</h3>
                  <p className="text-[11px] text-gray-500">{themeOption.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Size */}
        <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Type className="w-5 h-5 text-[#5D5FEF]" />
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-wider text-xs">
              Font Size
            </h2>
          </div>
          <div className="space-y-3">
            {fontSizes.map((size) => {
              const isSelected = fontSize === size.id;
              return (
                <button
                  key={size.id}
                  onClick={() => setFontSize(size.id as 'small' | 'medium' | 'large')}
                  className={`w-full p-5 rounded-2xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                      : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-black text-gray-900">{size.label}</span>
                    <span
                      className="text-gray-500 font-medium"
                      style={{ fontSize: size.size }}
                    >
                      Sample Text
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceView;

