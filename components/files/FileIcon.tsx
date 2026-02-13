
import React from 'react';
import { 
  Folder, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  FilePieChart, 
  BookOpen, 
  Archive,
  FileCode,
  Layout,
  FileSpreadsheet,
  FileDown,
  Database,
  Settings,
  FileJson,
  Terminal,
  Hash,
  Braces,
  Table,
} from 'lucide-react';
import { FileType } from '../../types';

interface FileIconProps {
  type: FileType;
  className?: string;
  fileName?: string; // Optional: for extension-specific icon selection
}

// Get extension-specific icon for code/data files
const getExtensionIcon = (fileName: string, className: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Python
  if (['py'].includes(ext)) {
    return <Terminal className={className} strokeWidth={2.5} />;
  }
  // JSON/YAML/TOML data files
  if (['json', 'geojson', 'ndjson'].includes(ext)) {
    return <Braces className={className} strokeWidth={2.5} />;
  }
  // XML/HTML markup
  if (['xml', 'html', 'svg', 'plist'].includes(ext)) {
    return <FileCode className={className} strokeWidth={2.5} />;
  }
  // Shell scripts
  if (['sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd'].includes(ext)) {
    return <Terminal className={className} strokeWidth={2.5} />;
  }
  // SQL / Database
  if (['sql', 'graphql'].includes(ext)) {
    return <Database className={className} strokeWidth={2.5} />;
  }
  // CSV/TSV
  if (['csv', 'tsv'].includes(ext)) {
    return <Table className={className} strokeWidth={2.5} />;
  }
  // Config files
  if (['yaml', 'yml', 'toml', 'ini', 'env', 'conf', 'cfg', 'rc', 'properties', 'lock', 'editorconfig', 'gitignore', 'dockerignore'].includes(ext)) {
    return <Settings className={className} strokeWidth={2.5} />;
  }
  // Log files
  if (['log'].includes(ext)) {
    return <FileText className={className} strokeWidth={2.5} />;
  }
  return null;
};

const FileIcon: React.FC<FileIconProps> = ({ type, className = "w-6 h-6", fileName }) => {
  if (type === 'folder') {
    return (
      <Folder 
        className={`${className} fill-current`} 
        strokeWidth={2}
      />
    );
  }

  // If we have a fileName, try extension-specific icon for code/data/config types
  if (fileName && (type === 'code' || type === 'data' || type === 'config')) {
    const extIcon = getExtensionIcon(fileName, className);
    if (extIcon) return extIcon;
  }

  switch (type) {
    case 'document':
      return <FileText className={className} strokeWidth={2.5} />;
    case 'image':
      return <ImageIcon className={className} strokeWidth={2.5} />;
    case 'video':
      return <Film className={className} strokeWidth={2.5} />;
    case 'audio':
      return <Music className={className} strokeWidth={2.5} />;
    case 'pdf':
      return <FilePieChart className={className} strokeWidth={2.5} />;
    case 'book':
      return <BookOpen className={className} strokeWidth={2.5} />;
    case 'archive':
      return <Archive className={className} strokeWidth={2.5} />;
    case 'code':
      return <FileCode className={className} strokeWidth={2.5} />;
    case 'data':
      return <Braces className={className} strokeWidth={2.5} />;
    case 'spreadsheet':
      return <FileSpreadsheet className={className} strokeWidth={2.5} />;
    case 'config':
      return <Settings className={className} strokeWidth={2.5} />;
    default:
      return <Layout className={className} strokeWidth={2.5} />;
  }
};

export default FileIcon;
