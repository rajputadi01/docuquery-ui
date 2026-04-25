import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { FileUp, FileText, Loader2, Send, Trash2, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import './App.css';

// Sub-component to render individual chat bubbles and handle their own accordion state
const ChatMessage = ({ msg }) => {
  const [showSources, setShowSources] = useState(false);
  const isUser = msg.sender === 'user';

  return (
    <div className={`chat-bubble ${isUser ? 'user' : 'ai'}`}>
      <div>{msg.text}</div>
      
      {/* Enterprise Auditability: Confidence Score & Sources */}
      {!isUser && msg.confidenceScore > 0 && (
        <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '0.75rem', paddingTop: '0.5rem' }}>
          <div className="confidence-badge">
            <Zap size={12} fill="currentColor" />
            Relevance Score: {(msg.confidenceScore * 100).toFixed(1)}%
          </div>
          
          {msg.sources && msg.sources.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <button className="sources-toggle" onClick={() => setShowSources(!showSources)}>
                {showSources ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showSources ? 'Hide Sources' : 'View Extracted Sources'}
              </button>
              
              {showSources && (
                <div className="sources-content">
                  {msg.sources.map((source, idx) => (
                    <div key={idx} style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px dashed #cbd5e1' }}>
                      <em>"...{source.trim()}..."</em>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function App() {
  // Global State
  const [documents, setDocuments] = useState([]); // Array of {id, name, time}
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  
  // Data Maps (Stored by documentId)
  const [summaries, setSummaries] = useState({});
  const [chatHistories, setChatHistories] = useState({}); 
  
  // Input State
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState('');
  
  // Auto-scroll ref for chat
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistories, activeDocumentId]);

  // 1. Handle File Upload
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('https://docuquery-api-idh9.onrender.com/api/documents/upload', formData);
      const newDocId = response.data.documentId;
      
      // Add to document library array
      setDocuments([{
        id: newDocId,
        name: file.name,
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }, ...documents]);
      
      // Set as active
      setActiveDocumentId(newDocId);
      setFile(null); // Clear input
      
      // Initialize empty chat history for this doc
      setChatHistories(prev => ({...prev, [newDocId]: []}));
      
    } catch (error) {
      alert("Upload failed: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Document Deletion
  const handleDelete = async (e, idToDelete) => {
    e.stopPropagation(); // Prevent clicking the row
    if (!window.confirm("Are you sure you want to delete this document from the AI memory?")) return;
    
    try {
      await axios.delete(`https://docuquery-api-idh9.onrender.com/api/documents/${idToDelete}`);
      
      // Remove from library
      setDocuments(documents.filter(doc => doc.id !== idToDelete));
      
      // Clean up maps
      const newSummaries = {...summaries}; delete newSummaries[idToDelete]; setSummaries(newSummaries);
      const newChats = {...chatHistories}; delete newChats[idToDelete]; setChatHistories(newChats);
      
      // Reset active view if we deleted the currently viewed doc
      if (activeDocumentId === idToDelete) {
        setActiveDocumentId(documents.length > 1 ? documents.find(d => d.id !== idToDelete).id : null);
      }
    } catch (error) {
      alert("Failed to delete: " + (error.response?.data?.message || error.message));
    }
  };

  // 3. Handle Fetching Summary
  const handleGetSummary = async () => {
    if (!activeDocumentId) return;
    setLoading(true);
    try {
      const response = await axios.get(`https://docuquery-api-idh9.onrender.com/api/documents/${activeDocumentId}/summary`);
      // Save summary mapped to this document ID
      setSummaries(prev => ({...prev, [activeDocumentId]: response.data}));
    } catch (error) {
      alert("Failed to get summary: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Asking a Question
  const handleAskQuestion = async () => {
    if (!activeDocumentId || !question.trim()) return;
    
    const userQ = question;
    setQuestion(''); // Clear input instantly for better UX
    
    // Append user question to local chat UI instantly
    const newChatMsg = { sender: 'user', text: userQ };
    setChatHistories(prev => ({
      ...prev,
      [activeDocumentId]: [...(prev[activeDocumentId] || []), newChatMsg]
    }));

    setLoading(true);
    try {
      const response = await axios.post(`https://docuquery-api-idh9.onrender.com/api/documents/${activeDocumentId}/query`, {
        question: userQ
      });
      
      // Append AI response with Auditability metrics
      const aiResponseMsg = { 
        sender: 'ai', 
        text: response.data.answer,
        confidenceScore: response.data.confidenceScore,
        sources: response.data.sourceSnippets
      };
      
      setChatHistories(prev => ({
        ...prev,
        [activeDocumentId]: [...(prev[activeDocumentId] || []), aiResponseMsg]
      }));

    } catch (error) {
      alert("Query failed: " + (error.response?.data?.message || error.message));
      // Remove the optimistic user message if it failed
      setChatHistories(prev => ({
        ...prev,
        [activeDocumentId]: prev[activeDocumentId].slice(0, -1)
      }));
    } finally {
      setLoading(false);
    }
  };

  // Get active data based on selected tab
  const activeSummary = summaries[activeDocumentId];
  const activeChat = chatHistories[activeDocumentId] || [];

  return (
    <div className="app-container">
      {/* LEFT PANEL: INGESTION & LIBRARY */}
      <div className="left-panel">
        <div className="header-title">
          <FileText color="#2563eb" /> DocuQuery AI
        </div>
        
        <div className="upload-box">
          <input 
            type="file" 
            accept=".pdf"
            onChange={(e) => setFile(e.target.files[0])} 
            style={{marginBottom: '1rem', width: '100%'}}
          />
          <button className="btn" onClick={handleUpload} disabled={!file || loading}>
            {loading && !activeDocumentId ? <Loader2 className="lucide-spin" /> : <FileUp />}
            Upload & Process
          </button>
        </div>

        {/* The Document Library */}
        {documents.length > 0 && (
          <>
            <div className="doc-list-header">Active Memory ({documents.length}/5)</div>
            <div className="doc-list">
              {documents.map((doc) => (
                <div 
                  key={doc.id} 
                  className={`doc-item ${activeDocumentId === doc.id ? 'active' : ''}`}
                  onClick={() => setActiveDocumentId(doc.id)}
                >
                  <div className="doc-info">
                    <span className="doc-name">{doc.name}</span>
                    <span className="doc-time">Ingested: {doc.time}</span>
                  </div>
                  <button 
                    className="delete-btn" 
                    title="Delete from memory"
                    onClick={(e) => handleDelete(e, doc.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* RIGHT PANEL: INTELLIGENCE */}
      <div className="right-panel">
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Structured Output
          </div>
          <div 
            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            RAG Assistant
          </div>
        </div>

        <div className="content-card">
          {!activeDocumentId ? (
            <div style={{color: '#94a3b8', textAlign: 'center', margin: 'auto'}}>
              Please upload or select a document from the library.
            </div>
          ) : (
            <>
              {/* SUMMARY TAB */}
              {activeTab === 'summary' && (
                <div style={{overflowY: 'auto', paddingRight: '1rem'}}>
                  <button className="btn" onClick={handleGetSummary} disabled={loading} style={{width: 'auto'}}>
                    {loading && !activeSummary ? <Loader2 className="lucide-spin"/> : null} 
                    {activeSummary ? "Refresh Metadata" : "Generate JSON Metadata"}
                  </button>
                  
                  {activeSummary && (
                    <div style={{marginTop: '2rem'}}>
                      <h3 style={{marginBottom: '0.5rem', color: '#0f172a'}}>Document Classification:</h3>
                      <p style={{color: '#2563eb', fontWeight: 'bold', fontSize: '1.1rem'}}>{activeSummary.documentType}</p>
                      
                      <h3 style={{marginTop: '1.5rem', marginBottom: '0.5rem', color: '#0f172a'}}>Executive Summary:</h3>
                      <p style={{lineHeight: '1.6'}}>{activeSummary.shortSummary}</p>
                      
                      <h3 style={{marginTop: '1.5rem', marginBottom: '0.5rem', color: '#0f172a'}}>Extracted Entities:</h3>
                      <ul style={{paddingLeft: '1.5rem', lineHeight: '1.6'}}>
                        {activeSummary.keyEntities.map((entity, idx) => (
                          <li key={idx}>{entity}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* CHAT TAB */}
              {activeTab === 'chat' && (
                <div className="chat-container">
                  <div className="chat-history">
                    {activeChat.length === 0 ? (
                      <div style={{color: '#94a3b8', textAlign: 'center', marginTop: '2rem'}}>
                        I have analyzed the document. What would you like to know?
                      </div>
                    ) : (
                      activeChat.map((msg, idx) => <ChatMessage key={idx} msg={msg} />)
                    )}
                    <div ref={chatEndRef} /> {/* Auto-scroll target */}
                  </div>

                  <div className="chat-input-group">
                    <input 
                      type="text" 
                      className="chat-input"
                      placeholder="Ask a question about this document..."
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                      disabled={loading}
                    />
                    <button 
                      className="btn" 
                      style={{width: 'auto'}} 
                      onClick={handleAskQuestion}
                      disabled={!question.trim() || loading}
                    >
                      {loading ? <Loader2 className="lucide-spin"/> : <Send size={18}/>}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;