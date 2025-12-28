
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  Download, 
  FileText, 
  FolderPlus, 
  Calendar, 
  Edit3, 
  ChevronUp, 
  ChevronDown,
  Upload,
  Settings,
  AlertCircle,
  Moon,
  Sun,
  Layout,
  Move
} from 'lucide-react';
import { BundleConfig, BundleDocument, BundleSection, IndexLayout } from './types';
import { generateBundle, getPdfPageCount } from './services/pdfService';

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  const [config, setConfig] = useState<BundleConfig>({
    caseNumber: '',
    caseName: '',
    courtName: '',
    sections: [
      { id: 'initial-section', title: 'Main Documents', documents: [] }
    ],
    indexLayout: {
      caseName: { x: 50, y: 760 },
      caseNumber: { x: 50, y: 745 },
      courtName: { x: 50, y: 730 }
    }
  });

  const [activeTab, setActiveTab] = useState<'build' | 'layout'>('build');
  const [isGenerating, setIsGenerating] = useState(false);
  const configInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const updateMetadata = (field: keyof BundleConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const addSection = () => {
    const newSection: BundleSection = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Section',
      documents: []
    };
    setConfig(prev => ({ ...prev, sections: [...prev.sections, newSection] }));
  };

  const removeSection = (sectionId: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId)
    }));
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === sectionId ? { ...s, title } : s)
    }));
  };

  const handleFileUpload = async (sectionId: string, files: FileList | null) => {
    if (!files) return;
    const newDocs: BundleDocument[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') continue;
      const pageCount = await getPdfPageCount(file);
      newDocs.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name.replace('.pdf', ''),
        originalName: file.name,
        date: new Date().toISOString().split('T')[0],
        file,
        pageCount,
        isLateAddition: false,
        latePrefix: 'A'
      });
    }
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId ? { ...s, documents: [...s.documents, ...newDocs] } : s
      )
    }));
  };

  const updateDocument = (sectionId: string, docId: string, updates: Partial<BundleDocument>) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId 
          ? { ...s, documents: s.documents.map(d => d.id === docId ? { ...d, ...updates } : d) }
          : s
      )
    }));
  };

  const removeDocument = (sectionId: string, docId: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => 
        s.id === sectionId ? { ...s, documents: s.documents.filter(d => d.id !== docId) } : s
      )
    }));
  };

  const moveDocument = (sectionId: string, docId: string, direction: 'up' | 'down') => {
    setConfig(prev => {
      const section = prev.sections.find(s => s.id === sectionId);
      if (!section) return prev;
      const docs = [...section.documents];
      const index = docs.findIndex(d => d.id === docId);
      if (index === -1) return prev;
      if (direction === 'up' && index > 0) {
        [docs[index - 1], docs[index]] = [docs[index], docs[index - 1]];
      } else if (direction === 'down' && index < docs.length - 1) {
        [docs[index], docs[index + 1]] = [docs[index + 1], docs[index]];
      }
      return {
        ...prev,
        sections: prev.sections.map(s => s.id === sectionId ? { ...s, documents: docs } : s)
      };
    });
  };

  const sortSectionByDate = (sectionId: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.map(s => {
        if (s.id !== sectionId) return s;
        const sorted = [...s.documents].sort((a, b) => a.date.localeCompare(b.date));
        return { ...s, documents: sorted };
      })
    }));
  };

  const saveConfig = async () => {
    const exportConfig = { ...config };
    const processedSections = await Promise.all(config.sections.map(async s => ({
      ...s,
      documents: await Promise.all(s.documents.map(async d => {
        if (d.file) {
          const buffer = await d.file.arrayBuffer();
          const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
          return { ...d, file: null, base64Data: base64 };
        }
        return d;
      }))
    })));
    const blob = new Blob([JSON.stringify({ ...exportConfig, sections: processedSections }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bundle-config-${config.caseNumber || 'export'}.json`;
    a.click();
  };

  const loadConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loaded = JSON.parse(event.target?.result as string) as BundleConfig;
        // Ensure default layout if missing
        if (!loaded.indexLayout) {
          loaded.indexLayout = {
            caseName: { x: 50, y: 760 },
            caseNumber: { x: 50, y: 745 },
            courtName: { x: 50, y: 730 }
          };
        }
        setConfig(loaded);
      } catch (err) {
        alert("Invalid config file");
      }
    };
    reader.readAsText(file);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const pdfBytes = await generateBundle(config);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bundle-${config.caseNumber || 'Output'}.pdf`;
      a.click();
    } catch (err) {
      console.error(err);
      alert("Failed to generate bundle.");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateLayoutPos = (key: keyof IndexLayout, x: number, y: number) => {
    setConfig(prev => ({
      ...prev,
      indexLayout: {
        ...(prev.indexLayout || {
          caseName: { x: 50, y: 760 },
          caseNumber: { x: 50, y: 745 },
          courtName: { x: 50, y: 730 }
        }),
        [key]: { x, y }
      }
    }));
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Sidebar */}
      <aside className="w-full lg:w-96 bg-white dark:bg-slate-800 border-b lg:border-r border-slate-200 dark:border-slate-700 p-6 space-y-8 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText className="text-indigo-600 dark:text-indigo-400" />
              eBundle: Court Bundle Generator
            </h1>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-600" />}
          </button>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Settings size={16} /> Case Details
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Case Number', field: 'caseNumber' as const },
              { label: 'Case Name', field: 'caseName' as const },
              { label: 'Court Name', field: 'courtName' as const }
            ].map((item) => (
              <div key={item.field}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{item.label}</label>
                <input 
                  type="text" 
                  value={config[item.field] as string}
                  onChange={(e) => updateMetadata(item.field, e.target.value)}
                  placeholder={`e.g. ${item.label}`}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Download size={16} /> Configuration
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={saveConfig} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium">
              <Download size={16} /> Save
            </button>
            <button onClick={() => configInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium">
              <Upload size={16} /> Load
            </button>
            <input type="file" ref={configInputRef} className="hidden" accept=".json" onChange={loadConfig} />
          </div>
        </section>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
          <button 
            disabled={isGenerating || config.sections.every(s => s.documents.length === 0)}
            onClick={handleGenerate}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:shadow-none transition-all flex items-center justify-center gap-2 text-lg"
          >
            {isGenerating ? (
               <>
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                 Processing...
               </>
            ) : "Generate Bundle PDF"}
          </button>
          <p className="text-[10px] text-slate-400 mt-4 text-center">
            Files are processed entirely in your browser.
          </p>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl w-fit">
            <button 
              onClick={() => setActiveTab('build')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'build' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <FileText size={18} /> Documents
            </button>
            <button 
              onClick={() => setActiveTab('layout')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'layout' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <Layout size={18} /> Index Layout
            </button>
          </div>

          {activeTab === 'build' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Bundle Structure</h2>
                <button onClick={addSection} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                  <FolderPlus size={18} /> Add Section
                </button>
              </div>
              <div className="space-y-6">
                {config.sections.map((section) => (
                  <div key={section.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Edit3 size={18} className="text-slate-400" />
                        <input 
                          type="text" 
                          value={section.title}
                          onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                          className="bg-transparent border-none font-semibold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 rounded px-2 w-full"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => sortSectionByDate(section.id)} className="p-2 text-slate-500 hover:text-indigo-600 rounded-lg" title="Sort by Date">
                          <Calendar size={18} />
                        </button>
                        <button onClick={() => removeSection(section.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {section.documents.map((doc) => (
                        <div key={doc.id} className="flex flex-col md:flex-row items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all">
                          <div className="flex flex-col gap-1">
                            <button onClick={() => moveDocument(section.id, doc.id, 'up')} className="text-slate-400 hover:text-indigo-600"><ChevronUp size={16}/></button>
                            <button onClick={() => moveDocument(section.id, doc.id, 'down')} className="text-slate-400 hover:text-indigo-600"><ChevronDown size={16}/></button>
                          </div>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Document Name</label>
                                <input 
                                  type="text" 
                                  value={doc.name} 
                                  onChange={(e) => updateDocument(section.id, doc.id, { name: e.target.value })}
                                  className="w-full text-sm font-medium dark:bg-slate-900 dark:border-slate-600 dark:text-white border rounded p-1" 
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Date</label>
                                <input 
                                  type="date" 
                                  value={doc.date} 
                                  onChange={(e) => updateDocument(section.id, doc.id, { date: e.target.value })}
                                  className="w-full text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white border rounded p-1" 
                                />
                            </div>
                            <div className="flex flex-col justify-end">
                                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={doc.isLateAddition} 
                                    onChange={(e) => updateDocument(section.id, doc.id, { isLateAddition: e.target.checked })}
                                    className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  Late Addition
                                  {doc.isLateAddition && (
                                    <input 
                                      className="w-12 text-center border rounded dark:bg-slate-900 dark:border-slate-600" 
                                      value={doc.latePrefix} 
                                      placeholder="Pfx"
                                      onChange={(e) => updateDocument(section.id, doc.id, { latePrefix: e.target.value.toUpperCase() })} 
                                    />
                                  )}
                                </label>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{doc.pageCount} Pages</span>
                            <button onClick={() => removeDocument(section.id, doc.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))}
                      <div className="mt-4">
                        <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 cursor-pointer transition-all">
                          <Plus className="text-slate-400 mb-1" />
                          <span className="text-sm text-slate-500">Drag or Click to add PDF Documents</span>
                          <input type="file" multiple accept=".pdf" className="hidden" onChange={(e) => handleFileUpload(section.id, e.target.files)} />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">Index Page Editor</h2>
                  <p className="text-sm text-slate-500">Reposition header items by dragging them on the page preview below.</p>
                </div>
              </div>
              
              <div className="flex justify-center bg-slate-200 dark:bg-slate-900 p-8 rounded-2xl overflow-hidden min-h-[700px]">
                {/* A4 Preview Shell */}
                <div 
                  className="relative bg-white shadow-2xl overflow-hidden border border-slate-300" 
                  style={{ width: '595px', height: '842px', minWidth: '595px', transform: 'scale(0.8)', transformOrigin: 'top center' }}
                >
                  <div className="absolute top-12 w-full text-center font-bold text-xl uppercase tracking-widest border-b border-slate-200 pb-4 text-slate-800">Index</div>
                  
                  {/* Draggable Meta Blocks */}
                  {[
                    { key: 'caseName' as const, label: 'Case:', value: config.caseName || '[Case Name]' },
                    { key: 'caseNumber' as const, label: 'Case No:', value: config.caseNumber || '[Case Number]' },
                    { key: 'courtName' as const, label: 'Court:', value: config.courtName || '[Court Name]' }
                  ].map((meta) => {
                    const pos = config.indexLayout?.[meta.key] || { x: 50, y: 700 };
                    // Convert PDF-style bottom-up Y (0 at bottom) to CSS top-down Y
                    const topY = 842 - pos.y;
                    
                    return (
                      <div 
                        key={meta.key}
                        className="absolute cursor-move select-none p-2 border-2 border-dashed border-transparent hover:border-indigo-400 hover:bg-indigo-50 rounded flex items-center gap-2 group z-10"
                        style={{ left: pos.x, top: topY }}
                        onMouseDown={(e) => {
                          const startX = e.clientX;
                          const startY = e.clientY;
                          const initialX = pos.x;
                          const initialY = pos.y;
                          
                          const move = (moveEvent: MouseEvent) => {
                            const dx = moveEvent.clientX - startX;
                            const dy = moveEvent.clientY - startY;
                            // dy is positive when moving down, but Y is bottom-up so we subtract it
                            updateLayoutPos(meta.key, Math.max(0, initialX + dx), Math.max(0, initialY - dy));
                          };
                          
                          const up = () => {
                            window.removeEventListener('mousemove', move);
                            window.removeEventListener('mouseup', up);
                          };
                          
                          window.addEventListener('mousemove', move);
                          window.addEventListener('mouseup', up);
                        }}
                      >
                        <Move size={14} className="text-indigo-500 opacity-0 group-hover:opacity-100" />
                        <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">{meta.label} {meta.value}</span>
                      </div>
                    );
                  })}

                  {/* Static Placeholder for Table structure */}
                  <div className="absolute top-[220px] left-12 right-12">
                    <div className="flex justify-between border-b-2 border-slate-800 pb-1 font-bold text-[10px] text-slate-800">
                      <span className="w-1/2">Document Name</span>
                      <span>Date</span>
                      <span>Page</span>
                    </div>
                    {config.sections.length > 0 ? (
                        config.sections.slice(0, 10).map((s, idx) => (
                            <React.Fragment key={s.id}>
                                <div className="py-2 text-[10px] font-bold uppercase text-slate-700 border-b border-slate-100">{s.title}</div>
                                {s.documents.slice(0, 3).map(d => (
                                    <div key={d.id} className="flex justify-between border-b border-slate-50 py-1 text-[9px] text-slate-600">
                                        <span className="w-1/2 truncate">{d.name}</span>
                                        <span>{d.date}</span>
                                        <span>{d.isLateAddition ? `${d.latePrefix}1` : '...'}</span>
                                    </div>
                                ))}
                            </React.Fragment>
                        ))
                    ) : (
                        [1,2,3,4,5].map(i => (
                            <div key={i} className="flex justify-between border-b border-slate-100 py-2 text-[9px] text-slate-400 italic">
                                <span className="w-1/2">Sample Document {i}...</span>
                                <span>01/01/2024</span>
                                <span>{i * 10}</span>
                            </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
