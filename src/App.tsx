import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Send, 
  Loader2, 
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnswerPayload, TraceStep, IngestionStatus } from './lib/rag/types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'ask' | 'docs' | 'chunks'>('ask');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<AnswerPayload | null>(null);
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [docs, setDocs] = useState<{id: string, chunks: number}[]>([]);
  const [chunks, setChunks] = useState<any[]>([]);
  const [sampleCount, setSampleCount] = useState(20);

  // Refresh status and docs
  const refreshData = async () => {
    try {
      const [statusRes, docsRes, chunksRes] = await Promise.all([
        fetch('/api/rag/status'),
        fetch('/api/rag/documents'),
        fetch('/api/rag/chunks')
      ]);
      const statusData = await statusRes.json();
      const docsData = await docsRes.json();
      const chunksData = await chunksRes.json();
      setStatus(statusData);
      setDocs(Array.isArray(docsData) ? docsData : []);
      setChunks(Array.isArray(chunksData) ? chunksData : []);
    } catch (e) {
      console.error("Fetch error", e);
    }
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleIngest = async () => {
    await fetch('/api/rag/ingest', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleCount }) 
    });
    refreshData();
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const data = await res.json();
      if (data && data.error) {
        throw new Error(data.error);
      }
      setAnswer(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans overflow-hidden">
      {/* Header: System Status & Stats */}
      <header className="p-6 border-b border-[#262626] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-black tracking-tighter uppercase leading-none italic">Agentic PDF // RAG</h1>
          <span className={`px-2 py-1 border text-[10px] font-mono rounded ${status?.status === 'ingesting' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500 animate-pulse' : status?.status === 'error' ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-[#1A1A1A] border-[#333] text-[#00FF41]'}`}>
            STATUS: {status?.status === 'ingesting' ? 'INGESTING' : status?.status === 'error' ? 'ERROR' : 'READY'}
          </span>
          {status?.status === 'error' && status?.error && (
            <span className="text-red-500 text-xs font-mono max-w-sm truncate" title={status.error}>
              {status.error}
            </span>
          )}
        </div>
        <div className="flex gap-8">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#737373] uppercase tracking-widest">Documents</span>
            <span className="text-xl font-bold font-mono">{docs.length}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#737373] uppercase tracking-widest">Total Chunks</span>
            <span className="text-xl font-bold font-mono">{status?.chunks || 0}</span>
          </div>
          <div className="flex items-center ml-4">
            <button 
              onClick={() => setActiveTab(activeTab === 'ask' ? 'docs' : 'ask')}
              className="text-[10px] font-bold text-[#737373] uppercase tracking-widest hover:text-[#00FF41] transition-colors"
            >
              {activeTab === 'ask' ? '[ VIEW CORPUS ]' : '[ BACK TO SEARCH ]'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar: Agent State & Self-Correction Trace */}
        <aside className="w-80 border-r border-[#262626] bg-[#0D0D0D] flex flex-col p-6 overflow-hidden">
          <h2 className="text-[11px] font-bold text-[#737373] uppercase tracking-[0.2em] mb-6">Correction Trace</h2>
          
          <div className="flex-1 space-y-6 overflow-y-auto pr-2 custom-scrollbar">
            {!answer && !loading && (
              <p className="text-[10px] font-mono text-[#525252] italic">Waiting for execution...</p>
            )}
            
            {loading && (
              <div className="flex items-center gap-3 py-4">
                <Loader2 className="w-4 h-4 animate-spin text-[#00FF41]" />
                <span className="text-[10px] font-mono text-[#00FF41] uppercase">Agent thinking...</span>
              </div>
            )}

            <AnimatePresence>
              {Array.isArray(answer?.self_correction) && answer.self_correction.map((step, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`relative pl-6 border-l ${step.action === 'validate' && step.output?.sufficient ? 'border-[#00FF41]' : 'border-[#262626]'}`}
                >
                  <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${
                    step.action === 'rewrite' ? 'bg-[#F27D26]' : 
                    step.action === 'validate' && step.output?.sufficient ? 'bg-[#00FF41]' : 'bg-[#737373]'
                  }`}></div>
                  <div className={`text-[10px] font-mono mb-1 uppercase ${
                    step.action === 'rewrite' ? 'text-[#F27D26] italic' :
                    step.action === 'validate' && step.output?.sufficient ? 'text-[#00FF41]' : 'text-[#737373]'
                  }`}>
                    Step {step.step}: {step.action}
                  </div>
                  <p className="text-[11px] text-[#E5E5E5] leading-relaxed">
                    {step.result}
                    {step.output?.missing_info && <span className="block text-[#737373] mt-1 italic">Missing: {step.output.missing_info}</span>}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="mt-auto pt-6 border-t border-[#262626]">
            <div className="p-4 bg-[#1A1A1A] border border-[#262626] rounded-lg">
              <div className="text-[10px] text-[#737373] uppercase mb-1 tracking-wider">Embedding Engine</div>
              <div className="text-xs font-mono text-[#A3A3A3]">gemini-embedding-2</div>
            </div>
            {docs.length === 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-[#737373] uppercase tracking-widest">Doc Count</label>
                  <span className="text-[10px] font-mono text-[#00FF41]">{sampleCount}</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="50" 
                  value={sampleCount}
                  onChange={(e) => setSampleCount(parseInt(e.target.value))}
                  className="w-full accent-[#00FF41]"
                />
                <button 
                  onClick={handleIngest}
                  className="w-full mt-4 py-2 border border-dashed border-[#333] text-[10px] font-bold text-[#737373] uppercase tracking-widest hover:border-[#00FF41] hover:text-[#00FF41] transition-all"
                >
                  Trigger Sample Ingestion
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 flex flex-col p-8 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'ask' ? (
              <motion.div 
                key="ask-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="mb-8">
                  <h2 className="text-[10px] font-bold text-[#00FF41] uppercase tracking-[0.3em] mb-2">User Question</h2>
                  <h3 className="text-4xl font-extrabold tracking-tight leading-tight min-h-[3rem]">
                    {question || "..."}
                  </h3>
                </div>

                {!answer && !loading && (
                  <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#1A1A1A] rounded-3xl opacity-30 select-none">
                    <Search size={80} className="mb-4" />
                    <p className="text-sm font-mono tracking-widest uppercase">Awaiting System Execution</p>
                  </div>
                )}

                {loading && (
                  <div className="flex-1 flex flex-col gap-6 animate-pulse">
                    <div className="h-32 bg-[#1A1A1A] rounded-xl border border-[#262626]" />
                    <div className="h-8 bg-[#1A1A1A] rounded w-64" />
                    <div className="grid grid-cols-2 gap-8">
                      <div className="h-40 bg-[#1A1A1A] rounded-lg" />
                      <div className="h-40 bg-[#1A1A1A] rounded-lg" />
                    </div>
                  </div>
                )}

                {answer && (
                  <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden">
                    {/* Answer & Evidence */}
                    <div className="flex flex-col gap-6 overflow-hidden">
                      <div className="flex-shrink-0">
                        <h2 className="text-[10px] font-bold text-[#737373] uppercase tracking-[0.2em] mb-3">Grounded Answer</h2>
                        <div className="bg-[#1A1A1A] p-6 rounded-xl border border-[#262626] text-sm leading-relaxed text-[#D4D4D4] shadow-2xl relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-[#00FF41]"></div>
                          <p>
                            {typeof answer.answer === 'string' && answer.answer.split(' ').map((word, i) => {
                              // Simple highlight for "duration" related words
                              const isHighlight = /year|month|day|period|duration|effective|terminate|confidentiality/i.test(word);
                              return (
                                <span key={i} className={isHighlight ? "text-[#F5F5F5] font-bold underline decoration-[#00FF41]/50 decoration-2 underline-offset-2" : ""}>
                                  {word}{' '}
                                </span>
                              );
                            })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0">
                        <h2 className="text-[10px] font-bold text-[#737373] uppercase tracking-[0.2em] mb-3">Confidence Assessment</h2>
                        <div className="flex items-center gap-6 bg-[#0D0D0D] p-4 border border-[#1A1A1A] rounded-lg">
                          <div className="h-2 flex-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: answer.confidence === 'high' ? '92%' : answer.confidence === 'medium' ? '65%' : '30%' }}
                              className={`h-full ${answer.confidence === 'high' ? 'bg-[#00FF41]' : answer.confidence === 'medium' ? 'bg-yellow-500' : 'bg-red-500'}`}
                            />
                          </div>
                          <span className={`text-xl font-mono font-bold uppercase ${answer.confidence === 'high' ? 'text-[#00FF41]' : answer.confidence === 'medium' ? 'text-yellow-500' : 'text-red-500'}`}>
                            {answer.confidence}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Evidence Visualizer */}
                    <div className="flex flex-col overflow-hidden">
                      <h2 className="text-[10px] font-bold text-[#737373] uppercase tracking-[0.2em] mb-3 italic">Supporting Core Chunks</h2>
                      <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                        {Array.isArray(answer.evidence) && answer.evidence.map((ev, i) => (
                          <div key={i} className="p-4 border border-[#262626] rounded-lg bg-[#0D0D0D] group hover:border-[#00FF41]/50 transition-colors cursor-default">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-mono text-[#737373] uppercase">{ev.chunk_id} // PAGE {ev.page || '01'}</span>
                              <div className="px-2 py-0.5 bg-[#00FF41]/5 rounded border border-[#00FF41]/20 text-[9px] text-[#00FF41] font-mono">
                                RETRIEVED_SOURCE
                              </div>
                            </div>
                            <p className="text-[11px] font-mono leading-tight text-[#A3A3A3] line-clamp-4 italic">
                              "...{ev.snippet}..."
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="docs-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="mb-8">
                  <h2 className="text-[10px] font-bold text-[#00FF41] uppercase tracking-[0.3em] mb-2">Corpus Management</h2>
                  <h3 className="text-4xl font-extrabold tracking-tight leading-tight italic">NDA Knowledge Base</h3>
                </div>
                
                <div className="flex-1 grid grid-cols-2 gap-8 overflow-hidden">
                  <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                    <h4 className="text-[10px] font-bold text-[#737373] uppercase mb-2">Ingested Documents</h4>
                    {docs.map(doc => (
                      <div key={doc.id} className="p-4 bg-[#1A1A1A] border border-[#262626] rounded flex items-center justify-between group hover:border-[#00FF41]/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-[#0D0D0D] border border-[#262626] group-hover:text-[#00FF41] transition-colors"><Search size={14} /></div>
                          <div>
                            <p className="text-xs font-bold uppercase truncate max-w-[200px]">{doc.id}</p>
                            <p className="text-[10px] font-mono text-[#737373]">{doc.chunks} CHUNKS EMBEDDED</p>
                          </div>
                        </div>
                        <ExternalLink size={12} className="text-[#525252]" />
                      </div>
                    ))}
                  </div>
                  
                  <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                    <h4 className="text-[10px] font-bold text-[#737373] uppercase mb-2">Atomic Chunks</h4>
                    <div className="space-y-2">
                      {chunks.slice(0, 10).map((c, i) => (
                        <div key={i} className="p-3 bg-[#0D0D0D] border border-[#1A1A1A] rounded text-[9px] font-mono text-[#A3A3A3]">
                          <span className="text-[#525252] block mb-1">{c.chunk_id}</span>
                          {c.text.slice(0, 150)}...
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className="mt-auto pt-6 border-t border-[#262626] flex gap-4 items-center">
            <form onSubmit={handleAsk} className="flex-1 flex gap-4">
              <input 
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="TYPE A QUESTION ABOUT THE NDA CORPUS..."
                className="flex-1 bg-[#111] border border-[#262626] px-4 py-3 rounded text-[11px] text-[#A3A3A3] font-mono placeholder:text-[#333] focus:outline-none focus:border-[#00FF41]/50 transition-colors uppercase tracking-widest"
              />
              <button 
                type="submit"
                disabled={loading || !question.trim()}
                className="bg-[#F5F5F5] text-black px-8 py-3 font-black text-xs uppercase tracking-tighter hover:bg-[#00FF41] hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed group flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'EXECUTE AGENT'}
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Footer Bar */}
      <footer className="bg-[#0A0A0A] border-t border-[#262626] px-6 py-2 flex justify-between items-center text-[10px] font-mono text-[#525252] tracking-widest uppercase">
        <div className="flex gap-4">
          <span>VECTOR STORE: SIMPLE_IN_MEM</span>
          <span className="text-[#262626]">//</span>
          <span>BM25: EMULATED</span>
        </div>
        <div className="flex items-center gap-6">
          <div>TRACE_ID: {answer ? '98a2-f112-7cc8-00x' : 'NONE'}</div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${status ? 'bg-[#00FF41]' : 'bg-[#737373]'}`}></div>
            API UPTIME: {status ? 'STABLE' : 'OFFLINE'}
          </div>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #0A0A0A;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #262626;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }
      `}} />
    </div>
  );
}
