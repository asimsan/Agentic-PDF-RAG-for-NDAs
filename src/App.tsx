import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Send, 
  Loader2, 
  ExternalLink,
  Trash2,
  ChevronRight, 
  FileText, 
  Info, 
  ShieldCheck, 
  Share2, 
  Download, 
  Copy, 
  RotateCcw, 
  ThumbsUp, 
  ThumbsDown, 
  MoreHorizontal,
  Layers,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnswerPayload, TraceStep, IngestionStatus } from './lib/rag/types';

interface ChatMessage {
  id: string;
  question: string;
  answer: AnswerPayload | null;
  loading: boolean;
  error?: string;
  uiTab?: 'answer' | 'sources';
}

interface Thread {
  id: string;
  name: string;
  documentId?: string;
  messages: ChatMessage[];
  activeMessageId: string | null;
}

const FormattedAnswer = ({ content, evidence }: { content: string, evidence: any[] }) => {
  const renderContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[[\w\.-]+\])/);
    
    return parts.map((part, i) => {
      const match = part.match(/^\[([\w\.-]+)\]$/);
      if (match) {
        const chunkId = match[1];
        const sourceIndex = Array.isArray(evidence) ? evidence.findIndex(e => e.chunk_id === chunkId) : -1;
        if (sourceIndex !== -1) {
          return (
            <span key={i} className="citation-pill" title={evidence[sourceIndex].snippet}>
              {sourceIndex + 1}
            </span>
          );
        }
        return <span key={i} className="text-gray-400 text-[10px]">{part}</span>;
      }
      return (
        <span key={i} className="inline-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {part}
          </ReactMarkdown>
        </span>
      );
    });
  };

  return <div className="markdown-body">{renderContent(content)}</div>;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'ask' | 'docs' | 'chunks'>('ask');
  const [question, setQuestion] = useState('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [docs, setDocs] = useState<{id: string, chunks: number}[]>([]);
  const [chunks, setChunks] = useState<any[]>([]);
  const [sampleCount, setSampleCount] = useState(20);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeThread = threads.find(t => t.id === activeThreadId);
  const messages = activeThread?.messages || [];
  const activeMessageId = activeThread?.activeMessageId;
  const activeMessage = messages.find(m => m.id === activeMessageId) || messages[messages.length - 1];

  const setMsgTab = (msgId: string, tab: 'answer' | 'sources') => {
    setThreads(prev => prev.map(t => {
      if (t.id === activeThreadId) {
        return {
          ...t,
          messages: t.messages.map(m => m.id === msgId ? { ...m, uiTab: tab } : m)
        };
      }
      return t;
    }));
  };

  useEffect(() => {
    if (threads.length === 0) {
      const id = Math.random().toString(36).substring(7);
      setThreads([{ id, name: 'New Conversation', documentId: undefined, messages: [], activeMessageId: null }]);
      setActiveThreadId(id);
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Refresh status and docs
  const refreshData = async () => {
    try {
      const chunksUrl = selectedDocId 
        ? `/api/rag/chunks?documentId=${encodeURIComponent(selectedDocId)}`
        : '/api/rag/chunks';

      const [statusRes, docsRes, chunksRes] = await Promise.all([
        fetch('/api/rag/status'),
        fetch('/api/rag/documents'),
        fetch(chunksUrl)
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
  }, [selectedDocId]);

  const handleIngest = async () => {
    await fetch('/api/rag/ingest', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleCount }) 
    });
    refreshData();
  };

  const handleNewThread = () => {
    const id = Math.random().toString(36).substring(7);
    setThreads(prev => [...prev, { id, name: 'New Conversation', documentId: undefined, messages: [], activeMessageId: null }]);
    setActiveThreadId(id);
    setActiveTab('ask');
  };

  const handleDeleteThread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreads(prev => {
      const filtered = prev.filter(t => t.id !== id);
      if (activeThreadId === id) {
        setActiveThreadId(filtered[0]?.id || null);
      }
      return filtered;
    });
  };

  const handleSetActiveMessage = (msgId: string) => {
    setThreads(prev => prev.map(t => 
      t.id === activeThreadId ? { ...t, activeMessageId: msgId } : t
    ));
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !activeThreadId) return;
    
    const messageId = Math.random().toString(36).substring(7);
    const newQuestion = question;
    setQuestion('');
    
    const newMessage: ChatMessage = {
      id: messageId,
      question: newQuestion,
      answer: null,
      loading: true,
      uiTab: 'answer'
    };
    
    setThreads(prev => prev.map(t => 
      t.id === activeThreadId 
        ? { 
            ...t, 
            name: t.messages.length === 0 ? newQuestion : t.name,
            messages: [...t.messages, newMessage], 
            activeMessageId: messageId 
          } 
        : t
    ));

    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: newQuestion, documentId: activeThread?.documentId })
      });
      const data = await res.json();
      
      setThreads(prev => prev.map(t => 
        t.id === activeThreadId 
          ? { 
              ...t, 
              messages: t.messages.map(m => 
                m.id === messageId 
                  ? { ...m, loading: false, answer: data.error ? null : data, error: data.error } 
                  : m
              ) 
            } 
          : t
      ));
    } catch (e) {
      console.error(e);
      setThreads(prev => prev.map(t => 
        t.id === activeThreadId 
          ? { 
              ...t, 
              messages: t.messages.map(m => 
                m.id === messageId 
                  ? { ...m, loading: false, error: 'Failed to execute agent' } 
                  : m
              ) 
            } 
          : t
      ));
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9FAFB] text-gray-800 font-sans overflow-hidden">
      {/* Header: System Status & Stats */}
      <header className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Agentic PDF RAG</h1>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${status?.status === 'ingesting' ? 'bg-yellow-100 text-yellow-700 animate-pulse' : status?.status === 'error' ? 'bg-red-100 text-red-700' : status?.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {status?.status === 'ingesting' ? 'Ingesting' : status?.status === 'error' ? 'Error' : 'Ready'}
          </span>
          {status?.status === 'error' && status?.error && (
            <span className="text-red-500 text-xs truncate max-w-sm" title={status.error}>
              {status.error}
            </span>
          )}
        </div>
        <div className="flex gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500">Documents</span>
            <span className="text-sm font-semibold">{docs.length}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500">Total Chunks</span>
            <span className="text-sm font-semibold">{status?.chunks || 0}</span>
          </div>
          <div className="flex items-center ml-2 gap-4">
            <button 
              onClick={() => setActiveTab(activeTab === 'ask' ? 'docs' : 'ask')}
              className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors"
            >
              {activeTab === 'ask' ? 'View Corpus' : 'Back to Search'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar: Agent State & Self-Correction Trace */}
        <aside className="w-80 border-r border-gray-200 bg-white flex flex-col p-5 overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Conversations</h2>
            <button 
              onClick={handleNewThread}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              New Chat
            </button>
          </div>

          <div className="flex-shrink-0 max-h-[30%] overflow-y-auto mb-6 custom-scrollbar space-y-1 pr-2">
            {threads.map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveThreadId(t.id); setActiveTab('ask'); }}
                className={`w-full text-left p-2.5 rounded-lg text-sm transition-all flex items-center justify-between group ${
                  activeThreadId === t.id 
                    ? 'bg-gray-100 text-gray-900 font-medium' 
                    : 'bg-transparent text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="truncate pr-2">{t.name}</div>
                <button 
                  onClick={(e) => handleDeleteThread(t.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all p-1"
                >
                  <Trash2 size={14} />
                </button>
              </button>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-gray-700 mb-4">Correction Trace</h2>
          
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {!activeMessage && (
              <p className="text-sm text-gray-400">Waiting for execution...</p>
            )}
            
            {activeMessage?.loading && (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-blue-600">Agent thinking...</span>
              </div>
            )}

            <AnimatePresence>
              {Array.isArray(activeMessage?.answer?.self_correction) && activeMessage.answer.self_correction.map((step, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`relative pl-5 border-l-2 ${step.action === 'validate' && step.output?.sufficient ? 'border-green-500' : 'border-gray-200'}`}
                >
                  <div className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${
                    step.action === 'rewrite' ? 'bg-orange-500' : 
                    step.action === 'validate' && step.output?.sufficient ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                  <div className={`text-xs font-medium mb-1 ${
                    step.action === 'rewrite' ? 'text-orange-600' :
                    step.action === 'validate' && step.output?.sufficient ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    Step {step.step}: {step.action}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {step.result}
                    {step.action === 'validate' && step.output?.missing_info && <span className="block text-gray-500 mt-1">Missing: {step.output.missing_info}</span>}
                    {step.action === 'rewrite' && typeof step.output === 'string' && <span className="block text-gray-700 mt-1 font-medium">New query: "{step.output}"</span>}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="mt-auto pt-5 border-t border-gray-200">
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">Embedding Engine</div>
              <div className="text-xs text-gray-700">text-embedding-3-small</div>
            </div>
            {docs.length === 0 && (
              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-gray-600">Doc Count</label>
                  <span className="text-xs text-gray-800 font-medium">{sampleCount}</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="50" 
                  value={sampleCount}
                  onChange={(e) => setSampleCount(parseInt(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <button 
                  onClick={handleIngest}
                  className="w-full mt-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-all bg-white shadow-sm"
                >
                  Trigger Sample Ingestion
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="flex-1 flex flex-col p-6 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'ask' ? (
              <motion.div 
                key="ask-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full"
              >
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-10"
                >
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 select-none">
                      <Search size={48} className="mb-4 text-gray-300" />
                      <p className="text-sm font-medium">Awaiting System Execution</p>
                    </div>
                  )}

                  {messages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col gap-5 scroll-mt-8 transition-opacity ${activeMessageId === msg.id ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                      onClick={() => handleSetActiveMessage(msg.id)}
                    >
                      <div className="flex-shrink-0">
                        <h3 className="text-2xl font-semibold tracking-tight text-gray-900">
                          {msg.question}
                        </h3>
                      </div>

                      {msg.loading && (
                        <div className="flex flex-col gap-4 animate-pulse">
                          <div className="h-20 bg-gray-100 rounded-xl" />
                          <div className="h-6 bg-gray-100 rounded w-48" />
                        </div>
                      )}

                      {msg.error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                          Error: {msg.error}
                        </div>
                      )}

                      {msg.answer && (
                        <div className="flex flex-col gap-6">
                          {/* Tabs */}
                          <div className="flex items-center border-b border-gray-100 mb-2">
                            <button 
                              onClick={() => setMsgTab(msg.id, 'answer')}
                              className={`tab-button flex items-center gap-2 ${msg.uiTab === 'answer' ? 'active' : ''}`}
                            >
                              <Sparkles size={14} />
                              Answer
                            </button>
                            <button 
                              onClick={() => setMsgTab(msg.id, 'sources')}
                              className={`tab-button flex items-center gap-2 ${msg.uiTab === 'sources' ? 'active' : ''}`}
                            >
                              <Layers size={14} />
                              Sources
                              <span className="ml-1 text-[10px] bg-gray-100 px-1 rounded text-gray-400">
                                {msg.answer.evidence?.length || 0}
                              </span>
                            </button>

                            {/* Confidence Indicator */}
                            <div className="ml-auto flex items-center gap-2 pr-2">
                              <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-full border border-gray-100">
                                <ShieldCheck size={12} className={
                                  msg.answer.confidence === 'high' ? 'text-green-500' :
                                  msg.answer.confidence === 'medium' ? 'text-yellow-500' : 'text-red-500'
                                } />
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                                  {msg.answer.confidence} Confidence
                                </span>
                                <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden ml-1">
                                  <div 
                                    className={`h-full ${
                                      msg.answer.confidence === 'high' ? 'bg-green-500' :
                                      msg.answer.confidence === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: msg.answer.confidence === 'high' ? '100%' : msg.answer.confidence === 'medium' ? '60%' : '30%' }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {msg.uiTab === 'answer' ? (
                            <div className="flex flex-col gap-6">
                              <div className="min-h-[100px]">
                                <FormattedAnswer content={msg.answer.answer} evidence={msg.answer.evidence} />
                              </div>

                              {/* Action Bar */}
                              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                <div className="flex items-center gap-3 ml-auto">
                                  <div className="flex items-center gap-1">
                                    <div className="flex -space-x-1">
                                      {msg.answer.evidence?.slice(0, 3).map((_, i) => (
                                        <div key={i} className="w-5 h-5 rounded-full bg-perplexity-gray border-2 border-white flex items-center justify-center">
                                          <FileText size={10} className="text-gray-400" />
                                        </div>
                                      ))}
                                    </div>
                                    <span className="text-xs text-gray-500 font-medium">
                                      {msg.answer.evidence?.length} sources
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                              {Array.isArray(msg.answer.evidence) && msg.answer.evidence.map((ev, i) => (
                                <div key={i} className="p-4 bg-white border border-gray-200/60 rounded-2xl hover:border-perplexity-blue/30 hover:shadow-md transition-all group cursor-pointer">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-lg bg-perplexity-gray flex items-center justify-center text-[10px] font-bold text-gray-500">
                                        {i + 1}
                                      </div>
                                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate max-w-[120px]">
                                        {ev.document}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {ev.score !== undefined && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                          ev.score >= 0.8 ? 'bg-green-50 text-green-600' :
                                          ev.score >= 0.6 ? 'bg-yellow-50 text-yellow-600' :
                                          'bg-gray-100 text-gray-400'
                                        }`}>
                                          {Math.round(ev.score * 100)}%
                                        </span>
                                      )}
                                      <ExternalLink size={12} className="text-gray-300 group-hover:text-perplexity-blue transition-colors" />
                                    </div>
                                  </div>
                                  <h4 className="text-xs font-semibold text-gray-800 mb-2 line-clamp-1">
                                    Page {ev.page || '1'} · Section {i + 1}
                                  </h4>
                                  <p className="text-[11px] leading-relaxed text-gray-500 line-clamp-3 italic">
                                    "{ev.snippet}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="docs-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col overflow-hidden max-w-5xl mx-auto w-full"
              >
                <div className="mb-6">
                  <h3 className="text-2xl font-semibold tracking-tight text-gray-900">Knowledge Base</h3>
                </div>
                
                <div className="flex-1 grid grid-cols-2 gap-8 overflow-hidden">
                  <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Ingested Documents</h4>
                    {docs.map(doc => (
                      <div 
                        key={doc.id} 
                        onClick={() => setSelectedDocId(doc.id === selectedDocId ? null : doc.id)}
                        className={`p-3 border rounded-xl flex items-center justify-between hover:border-blue-300 transition-all shadow-sm cursor-pointer ${selectedDocId === doc.id ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100' : 'bg-white border-gray-200'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded ${selectedDocId === doc.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-500'}`}><Search size={16} /></div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate pr-2">{doc.id}</p>
                            <p className="text-xs text-gray-500">{doc.chunks} chunks</p>
                          </div>
                        </div>
                        <ExternalLink size={14} className={selectedDocId === doc.id ? 'text-blue-500' : 'text-gray-400'} />
                      </div>
                    ))}
                  </div>
                  
                  <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-700">
                        {selectedDocId ? 'Document Chunks' : 'Global Preview (Top 20)'}
                      </h4>
                      {selectedDocId && (
                        <button 
                          onClick={() => setSelectedDocId(null)}
                          className="text-[10px] uppercase tracking-wider font-bold text-blue-600 hover:text-blue-700"
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {(selectedDocId 
                        ? chunks.filter(c => c.document_id === selectedDocId)
                        : chunks.slice(0, 20)
                      ).map((c, i) => (
                        <div key={i} className="p-4 bg-white border border-gray-200 rounded-xl text-xs text-gray-600 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-900 font-semibold px-2 py-0.5 bg-gray-100 rounded text-[10px] uppercase tracking-tight">{c.chunk_id}</span>
                            <span className="text-[10px] text-gray-400 font-medium">Page {c.page || '1'}</span>
                          </div>
                          <p className="leading-relaxed">
                            {c.text}
                          </p>
                        </div>
                      ))}
                      {selectedDocId && chunks.filter(c => c.document_id === selectedDocId).length === 0 && (
                        <div className="text-center py-10 text-gray-400 italic text-sm">
                          No chunks found for this document.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <div className="mt-auto pt-4 max-w-3xl mx-auto w-full flex flex-col gap-2">
            <div className="flex justify-end">
              <select 
                value={activeThread?.documentId || ""} 
                onChange={(e) => {
                  const val = e.target.value;
                  setThreads(prev => prev.map(t => t.id === activeThreadId ? { ...t, documentId: val === "" ? undefined : val } : t));
                }}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-blue-500 max-w-[250px] truncate shadow-sm transition-all"
              >
                <option value="">Search: All Documents</option>
                {docs.map(d => (
                  <option key={d.id} value={d.id}>Search: {d.id}</option>
                ))}
              </select>
            </div>
            <form onSubmit={handleAsk} className="relative flex items-center">
              <input 
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask anything..."
                className="w-full bg-white border border-gray-300 pl-4 pr-12 py-3.5 rounded-full text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
              />
              <button 
                type="submit"
                disabled={messages.some(m => m.loading) || !question.trim() || !activeThreadId}
                className="absolute right-2 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-all disabled:opacity-50 disabled:hover:bg-blue-600 flex items-center justify-center"
              >
                {messages.some(m => m.loading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </section>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1D5DB;
        }
      `}} />
    </div>
  );
}
