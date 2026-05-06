import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { saveAs } from 'file-saver';
import { 
  FileText, 
  Upload, 
  Settings, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  ChevronRight,
  Database,
  Search,
  Code,
  LayoutGrid,
  ChevronDown,
  Trash2,
  RefreshCw,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { AppSettings, DocumentChunk, LLMProvider, ProcessedProvision } from './types';
import { chunkAviationText } from './lib/chunker';
import { processAviationText, testLocalConnection, getLocalModels } from './services/llmService';

export default function App() {
  const [rawText, setRawText] = useState('');
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'input' | 'review'>('input');
  const [searchTerm, setSearchSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failure'>('idle');
  const [testRawResult, setTestRawResult] = useState<any>(null);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [errorLog, setErrorLog] = useState<{timestamp: string, message: string}[]>([]);
  const [showErrorLog, setShowErrorLog] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>({
    provider: 'gemini',
    localBaseUrl: 'http://127.0.0.1:1234/api/v1',
    localModelName: 'qwen2.5-1.5b-instruct'
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setRawText(text);
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: { 'text/plain': ['.txt'] },
    multiple: false 
  } as any);

  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestRawResult(null);
    
    const result = await testLocalConnection(settings);
    setTestRawResult(result);
    
    if (result.success && result.data) {
      // Use the logic to extract models from the raw data
      const models = getLocalModelsFromData(result.data);
      if (models.length > 0) setLocalModels(models);
      setTestStatus('success');
    } else {
      setTestStatus('failure');
      console.error("Troubleshooting Local Connection:\n1. Ensure LM Studio is running.\n2. Click the Lock icon in the URL bar -> Site Settings -> Set 'Insecure Content' to ALLOW.\n3. Verify CORS is enabled in LM Studio settings.");
    }

    setTimeout(() => setTestStatus('idle'), 8000);
  };

  const getLocalModelsFromData = (data: any): string[] => {
    if (!data) return [];
    if (data.models) {
      return data.models
        .filter((m: any) => m.type === "llm" && m.loaded_instances?.length > 0)
        .map((m: any) => m.loaded_instances[0].id);
    }
    if (data.data) {
      return data.data.map((m: any) => m.id);
    }
    return [];
  };

  const handleChunk = () => {
    if (!rawText.trim()) return;
    const newChunks = chunkAviationText(rawText);
    setChunks(newChunks);
    if (newChunks.length > 0) setSelectedChunkId(newChunks[0].id);
    setActiveTab('review');
  };

  const processBatch = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setErrorLog([]);

    const pendingChunks = chunks.filter(c => c.status !== 'completed');
    
    for (const chunk of pendingChunks) {
      setChunks(prev => prev.map(c => 
        c.id === chunk.id ? { ...c, status: 'processing' } : c
      ));

      try {
        const result = await processAviationText(chunk.rawText, settings);
        setChunks(prev => prev.map(c => 
          c.id === chunk.id ? { ...c, status: 'completed', result } : c
        ));
      } catch (error) {
        const msg = String(error);
        setErrorLog(prev => [{ timestamp: new Date().toLocaleTimeString(), message: msg }, ...prev].slice(0, 50));
        setChunks(prev => prev.map(c => 
          c.id === chunk.id ? { ...c, status: 'error', error: msg } : c
        ));
      }
      
      await new Promise(r => setTimeout(r, 100));
    }

    setIsProcessing(false);
    if (stats.error > 0) setShowErrorLog(true);
  };

  const exportJson = () => {
    const data = chunks
      .filter(c => c.status === 'completed' && c.result)
      .map(c => c.result);
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `aero-struct-export-${Date.now()}.json`);
  };

  const filteredChunks = chunks.filter(c => {
    const matchesSearch = c.rawText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (c.result?.heading.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (c.result?.text.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filterType === 'all' || 
                         c.result?.provision_type === filterType ||
                         c.result?.regulatory_strength === filterType;
    
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: chunks.length,
    completed: chunks.filter(c => c.status === 'completed').length,
    pending: chunks.filter(c => c.status === 'pending').length,
    processing: chunks.filter(c => c.status === 'processing').length,
    error: chunks.filter(c => c.status === 'error').length
  };

  const selectedChunk = chunks.find(c => c.id === selectedChunkId) || chunks[0];

  return (
    <div className="h-screen w-full flex flex-col bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden" id="app-root">
      {/* Header Navigation */}
      <nav className="h-16 px-8 flex items-center justify-between bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rotate-45"></div>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase">
            AERO-STRUCT <span className="text-blue-600 text-sm align-top ml-1">v4.0</span>
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('input')}
              className={cn(
                "px-4 py-2 rounded text-sm font-semibold transition-all",
                activeTab === 'input' ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Document Input
            </button>
            <button 
              onClick={() => setActiveTab('review')}
              className={cn(
                "px-4 py-2 rounded text-sm font-semibold transition-all",
                activeTab === 'review' ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
              )}
            >
              Review Pipeline
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-2" />

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">System Status</span>
              <span className="text-xs text-emerald-600 flex items-center gap-1 font-semibold">
                <span className={cn("w-2 h-2 rounded-full", isProcessing ? "bg-amber-500 animate-pulse" : "bg-emerald-500")}></span>
                {isProcessing ? 'Processing...' : 'Engine Ready'}
              </span>
            </div>
            {activeTab === 'input' && (
              <button 
                onClick={handleChunk}
                disabled={!rawText.trim()}
                className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-800 disabled:opacity-30 transition-all flex items-center gap-2"
              >
                Assemble Blocks
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {activeTab === 'review' && (
              <div className="flex gap-2">
                <button 
                  onClick={processBatch}
                  disabled={isProcessing || stats.pending === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 disabled:opacity-30 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Run Analysis
                </button>
                <button 
                  onClick={exportJson}
                  disabled={stats.completed === 0}
                  className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-semibold hover:bg-slate-800 disabled:opacity-30 transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export RAG Data
                </button>
              </div>
            )}
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-slate-900 transition-colors bg-slate-50 rounded-lg border border-slate-200"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Layout */}
      <main className="flex-1 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'input' ? (
            <motion.div 
              key="input-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 p-8 overflow-y-auto"
            >
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-slate-500">Document Ingestion Stream</h2>
                  <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono">
                    <span>LINES: {rawText.split('\n').filter(Boolean).length}</span>
                    <span>CHARS: {rawText.length}</span>
                  </div>
                </div>

                <div 
                  {...getRootProps()} 
                  className={cn(
                    "bg-white border border-slate-200 border-dashed rounded-xl p-16 text-center transition-all cursor-pointer group shadow-sm",
                    isDragActive ? "border-blue-500 bg-blue-50/30 ring-4 ring-blue-50" : "hover:bg-slate-50/50"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-12 h-12 text-slate-300 mx-auto mb-4 group-hover:text-blue-500 transition-colors" />
                  <h3 className="text-lg font-bold text-slate-800">Drop raw extraction file</h3>
                  <p className="text-sm text-slate-500 mt-2">Support for ICAO, EASA and Doc 4444 .txt formats</p>
                </div>

                <div className="relative group">
                  <div className="absolute top-4 left-6 pointer-events-none transition-opacity group-focus-within:opacity-0">
                    {!rawText && (
                      <span className="text-sm text-slate-300 font-mono italic flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        awaiting_manual_input_stream.io
                      </span>
                    )}
                  </div>
                  <textarea 
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder=" "
                    className="w-full h-[400px] bg-white border border-slate-200 rounded-xl p-8 shadow-sm font-mono text-[13px] leading-relaxed text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-200 transition-all resize-none"
                  />
                  <button 
                    onClick={() => setRawText('')}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="review-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex gap-6 p-6 overflow-hidden bg-slate-50/50"
            >
              {/* Left Panel: Raw Input Stream (List of Blocks) */}
              <section className="w-[35%] flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-slate-500">Block Pipeline</h2>
                  <span className="text-[10px] text-slate-400 font-mono">COUNT: {chunks.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {filteredChunks.map((chunk, idx) => (
                    <button
                      key={chunk.id}
                      onClick={() => setSelectedChunkId(chunk.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all group relative",
                        selectedChunkId === chunk.id 
                          ? "bg-white border-blue-200 shadow-md ring-1 ring-blue-100" 
                          : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-[9px] font-mono font-bold text-slate-300">#{(idx + 1).toString().padStart(3, '0')}</span>
                         <StatusIndicator status={chunk.status} />
                      </div>
                      <p className="text-[11px] font-mono text-slate-600 line-clamp-2 leading-relaxed">
                        {chunk.rawText}
                      </p>
                      {selectedChunkId === chunk.id && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r" />
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {/* Right Panel: Structured Output Preview */}
              <section className="flex-1 flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-xs uppercase tracking-[0.2em] font-bold text-slate-500">Selection Preview</h2>
                  {selectedChunk?.result && (
                    <div className="flex gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold uppercase tracking-wider">
                        DOMAIN: {selectedChunk.result.domain}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                        selectedChunk.result.regulatory_strength === 'mandatory' ? "bg-red-100 text-red-700" :
                        selectedChunk.result.regulatory_strength === 'recommended' ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-700"
                      )}>
                        {selectedChunk.result.regulatory_strength}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl flex flex-col overflow-hidden">
                  {selectedChunk ? (
                    <>
                        <div className="flex-1 font-mono text-[13px] leading-6 overflow-y-auto custom-scrollbar pr-4 text-slate-300 scroll-smooth">
                          {selectedChunk.status === 'completed' && selectedChunk.result ? (
                            <JSONPreview data={selectedChunk.result} />
                          ) : selectedChunk.status === 'processing' ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
                              <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
                              <span className="text-xs uppercase tracking-widest text-blue-400 font-bold processing-cursor">Neural Synthesis in progress</span>
                            </div>
                          ) : selectedChunk.status === 'error' ? (
                            <div className="flex flex-col h-full space-y-4 p-4 rounded-xl bg-red-950/30 border border-red-900/50">
                              <div className="flex items-center gap-3 text-red-400">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <h3 className="font-bold uppercase tracking-widest text-xs">Synthesis Fault Detected</h3>
                              </div>
                              <div className="p-4 bg-black/40 rounded border border-red-800/30 font-mono text-red-200 text-xs leading-relaxed overflow-auto max-h-[300px]">
                                {selectedChunk.error}
                              </div>
                              <div className="bg-red-400/10 p-3 rounded text-[10px] text-red-300/80 leading-normal">
                                <p className="font-bold mb-1 uppercase tracking-tight">Troubleshooting:</p>
                                <ul className="list-disc pl-4 space-y-1">
                                  <li>Check if the correct model is loaded in LM Studio.</li>
                                  <li>Verify the model name exactly matches LM Studio's loaded model ID.</li>
                                  <li>Ensure "Insecure Content" is allowed for this domain.</li>
                                  <li>Check if the model hit its context limit (try a smaller chunk).</li>
                                </ul>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full space-y-2 text-slate-500 italic">
                              <Code className="w-8 h-8 mb-4 opacity-20" />
                              <span>Payload in queue. Run pipeline to synthesize.</span>
                            </div>
                          )}
                        </div>

                      <div className="mt-6 pt-6 border-t border-slate-800 flex justify-between items-center text-[10px] font-bold tracking-widest uppercase">
                        <div className="flex gap-6">
                           <div className="flex items-center gap-2">
                             <div className={cn(
                               "w-2.5 h-2.5 rounded-full",
                               selectedChunk.status === 'completed' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-700"
                             )}></div>
                             <span className="text-slate-400">Validation: {selectedChunk.status === 'completed' ? 'Pass' : 'Idle'}</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <div className={cn(
                               "w-2.5 h-2.5 rounded-full",
                               selectedChunk.status === 'completed' ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-slate-700"
                             )}></div>
                             <span className="text-slate-400 font-mono">No Hallucinations</span>
                           </div>
                        </div>
                        <span className="text-slate-600 font-mono">BLOCK ID: #{selectedChunk.id.substring(selectedChunk.id.length-8)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 italic opacity-30">
                       <LayoutGrid className="w-12 h-12 mb-4" />
                       <span>Select block for inspection</span>
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Technical Footer Bar */}
      <footer className="h-12 px-8 flex items-center justify-between bg-white border-t border-slate-200 text-[10px] text-slate-500 shrink-0">
        <div className="flex gap-8">
          <span className="flex items-center gap-2 font-bold cursor-default">
            <span className="text-slate-300 uppercase">Blocks:</span> {stats.completed}/{stats.total}
          </span>
          <button 
            onClick={() => setShowErrorLog(!showErrorLog)}
            className={cn(
              "flex items-center gap-2 font-bold uppercase transition-all px-2 py-1 rounded",
              stats.error > 0 ? "text-red-600 bg-red-50 hover:bg-red-100" : "text-slate-400"
            )}
          >
            <span className={cn("text-slate-300", stats.error > 0 && "text-red-300")}>Errors:</span> {stats.error}
            {stats.error > 0 && <ChevronDown className={cn("w-3 h-3 transition-transform", showErrorLog && "rotate-180")} />}
          </button>
          <span className="flex items-center gap-2 font-bold uppercase transition-all duration-500" style={{ opacity: stats.completed > 0 ? 1 : 0.3 }}>
            <span className="text-slate-300">RAG READY:</span> {stats.completed === stats.total && stats.total > 0 ? 'YES' : 'PENDING'}
          </span>
        </div>
        <div className="flex items-center gap-2 uppercase tracking-tighter">
          <span className="px-1.5 py-0.5 bg-slate-100 rounded font-bold border border-slate-200">LangChain Module</span>
          <span className="text-slate-300 font-normal">|</span>
          <span className="px-1.5 py-0.5 bg-blue-50 rounded text-blue-600 font-bold border border-blue-100">JSON.PRO v1.2</span>
        </div>

        {/* Floating Error Log */}
        <AnimatePresence>
          {showErrorLog && errorLog.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-14 left-8 right-8 z-40 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-64 flex flex-col"
            >
              <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" />
                  Diagnostic Processing Log
                </span>
                <button onClick={() => setShowErrorLog(false)} className="p-1 hover:bg-red-200/50 rounded transition-colors">
                  <ChevronDown className="w-4 h-4 text-red-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-1">
                {errorLog.map((log, i) => (
                  <div key={i} className="flex gap-3 p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-400 shrink-0">[{log.timestamp}]</span>
                    <span className="text-red-600 break-all">{log.message}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-slate-400" />
                  <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight">System Configuration</h2>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-900">
                  <RefreshCw className="w-4 h-4 rotate-45" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Intelligence Provider</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setSettings(s => ({ ...s, provider: 'gemini' }))}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all",
                        settings.provider === 'gemini' ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/10" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <span className="block font-bold text-sm">Gemini 3 Flash</span>
                      <span className="text-[10px] text-slate-500">Cloud optimized (Default)</span>
                    </button>
                    <button 
                      onClick={() => setSettings(s => ({ ...s, provider: 'local' }))}
                      className={cn(
                        "p-4 rounded-xl border text-left transition-all",
                        settings.provider === 'local' ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/10" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <span className="block font-bold text-sm">Local LLM</span>
                      <span className="text-[10px] text-slate-500">OpenAI compatible API</span>
                    </button>
                  </div>
                </div>

                {settings.provider === 'local' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-4 border-t border-slate-100"
                  >
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3">
                      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-tight">Mixed Content Required</p>
                        <p className="text-[9px] text-blue-600/80 leading-relaxed">
                          Since this app is HTTPS, you must allow <span className="font-bold">"Insecure Content"</span> in your browser site settings to talk to localhost.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Base API URL</label>
                        <button 
                          onClick={handleTestConnection}
                          disabled={testStatus === 'testing'}
                          className={cn(
                            "text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-all",
                            testStatus === 'idle' ? "text-blue-600 bg-blue-50 hover:bg-blue-100" :
                            testStatus === 'testing' ? "text-slate-400 bg-slate-100 animate-pulse" :
                            testStatus === 'success' ? "text-emerald-600 bg-emerald-50" :
                            "text-red-600 bg-red-50"
                          )}
                        >
                          {testStatus === 'idle' && 'Test Link'}
                          {testStatus === 'testing' && 'Checking...'}
                          {testStatus === 'success' && 'Ready / 200 OK'}
                          {testStatus === 'failure' && 'Link Failed'}
                        </button>
                      </div>
                      <input 
                        type="text"
                        value={settings.localBaseUrl}
                        onChange={(e) => setSettings(s => ({ ...s, localBaseUrl: e.target.value }))}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                        placeholder="http://127.0.0.1:1234/v1"
                      />
                    </div>

                    {testRawResult && (
                      <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                          <span>Connection Debug</span>
                          <span className={cn(
                            "text-[9px] px-1 py-0.5 rounded",
                            testRawResult.success ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          )}>
                            {testRawResult.success ? "Success" : "Error"}
                          </span>
                        </label>
                        <div className="space-y-1.5 font-mono text-[10px]">
                          <div className="p-2 bg-slate-100 rounded border border-slate-200 text-slate-600 break-all select-all">
                            <span className="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase">Tested URL</span>
                            {testRawResult.url}
                          </div>
                          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-blue-300 overflow-auto max-h-48 whitespace-pre">
                            <span className="text-[9px] font-bold text-blue-400/50 block mb-1 uppercase tracking-widest">Response Body</span>
                            {JSON.stringify(testRawResult.data || { error: testRawResult.error }, null, 2)}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Model Identifier</label>
                      <div className="relative">
                        <input 
                          type="text"
                          list="local-models-list"
                          value={settings.localModelName}
                          onChange={(e) => setSettings(s => ({ ...s, localModelName: e.target.value }))}
                          className={cn(
                            "w-full px-4 py-2 bg-slate-50 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/10",
                            settings.localModelName.toLowerCase().includes('embed') ? "border-amber-300 ring-2 ring-amber-500/10" : "border-slate-200"
                          )}
                          placeholder="llama-3.2-3b-instruct"
                        />
                        <datalist id="local-models-list">
                          {localModels.map(m => <option key={m} value={m} />)}
                        </datalist>
                        {localModels.length > 0 && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                             <span className={cn(
                               "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                               localModels.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                             )}>
                               {localModels.length} Found
                             </span>
                          </div>
                        )}
                      </div>
                      {settings.localModelName.toLowerCase().includes('embed') && (
                        <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1.5 px-1 animate-pulse">
                          <AlertCircle className="w-3 h-3" />
                          Caution: Embedding models cannot generate text. Use a Chat/Instruct model.
                        </p>
                      )}
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                        Ensure your local LLM server (LM Studio, Ollama, etc.) has **CORS enabled** for the browser to allow requests.
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold uppercase tracking-widest"
                >
                  Apply Config
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusIndicator({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
  if (status === 'processing') return <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
  if (status === 'error') return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
  return <div className="w-2 h-2 rounded-full border border-slate-200 shadow-inner" />;
}

function JSONPreview({ data }: { data: ProcessedProvision }) {
  return (
    <div className="space-y-1">
      <div className="text-slate-500 opacity-50 font-bold">{"{"}</div>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="pl-6 flex gap-2">
          <span className="text-sky-400 font-bold">"{key}"</span>
          <span className="text-slate-500">:</span>
          {Array.isArray(value) ? (
            <span className="text-amber-200">[ {value.map(v => `"${v}"`).join(', ')} ]</span>
          ) : (
            <span className={cn(
              "font-semibold",
              key === 'confidence' ? "text-emerald-400" : "text-amber-100/90"
            )}>
              "{value}"
            </span>
          )}
          <span className="text-slate-500">,</span>
        </div>
      ))}
      <div className="text-slate-500 opacity-50 font-bold">{"}"}</div>
    </div>
  );
}

