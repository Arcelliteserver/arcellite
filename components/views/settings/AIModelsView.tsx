import React, { useState } from 'react';
import { Sparkles, Check, ExternalLink } from 'lucide-react';
import { AI_MODELS } from '@/constants';

const AIModelsView: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Group models by provider
  const modelsByProvider = AI_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof AI_MODELS>);

  return (
    <div className="w-full">
      <div className="mb-6 md:mb-10">
        <div className="relative">
          <div className="absolute -left-2 sm:-left-3 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 pl-3 sm:pl-4 md:pl-6 relative mb-2">
            AI Models
            <span className="absolute -top-1 sm:-top-2 -right-4 sm:-right-6 md:-right-8 lg:-right-12 w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h1>
        </div>
        <p className="text-gray-500 font-medium text-xs md:text-sm pl-3 sm:pl-4 md:pl-6">Browse and manage available AI models</p>
      </div>

      <div className="space-y-6 md:space-y-8">
        {Object.entries(modelsByProvider).map(([provider, models]) => (
          <div key={provider} className="bg-white rounded-xl md:rounded-[2rem] border border-gray-100 p-5 md:p-6 lg:p-8 shadow-sm">
            <h2 className="text-base md:text-lg font-black text-gray-900 mb-4 md:mb-6 uppercase tracking-wider text-[10px] md:text-xs">
              {provider}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {models.map((model) => {
                const isSelected = selectedModel === model.id;
                return (
                  <div
                    key={model.id}
                    onClick={() => setSelectedModel(isSelected ? null : model.id)}
                    className={`p-4 md:p-6 rounded-xl md:rounded-2xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#5D5FEF] bg-[#5D5FEF]/5'
                        : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${model.bg} flex items-center justify-center shadow-sm p-2`}>
                        <img 
                          src={model.icon || '/assets/models/gemini-color.svg'} 
                          alt={model.provider}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 md:w-6 md:h-6 bg-[#5D5FEF] rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" />
                        </div>
                      )}
                    </div>
                    <h3 className="text-sm md:text-[15px] font-black text-gray-900 mb-1">{model.name}</h3>
                    <p className="text-[10px] md:text-[11px] text-gray-500 mb-2 md:mb-3">{model.provider}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Navigate to API Keys page
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-[11px] md:text-[12px] font-bold text-gray-700 transition-all"
                    >
                      <ExternalLink className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      <span>Configure</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AIModelsView;

