import { useState } from 'react';
import axios from 'axios';
import { FileUp, MessageSquare, FileText, Loader2, Send } from 'lucide-react';
import './App.css';

function App() {
  // State variables to track our app's data
  const [file, setFile] = useState(null);
  const [documentId, setDocumentId] = useState('');
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  
  // States for the AI responses
  const [summary, setSummary] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  // 1. Handle File Upload
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('https://docuquery-api-idh9.onrender.com/api/documents/upload', formData);
      setDocumentId(response.data.documentId);
      // Reset right panel states on new upload
      setSummary(null);
      setAnswer('');
    } catch (error) {
      alert("Upload failed: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Fetching Summary
  const handleGetSummary = async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const response = await axios.get(`https://docuquery-api-idh9.onrender.com/api/documents/${documentId}/summary`);
      setSummary(response.data);
    } catch (error) {
      alert("Failed to get summary: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Asking a Question
  const handleAskQuestion = async () => {
    if (!documentId || !question.trim()) return;
    setLoading(true);
    try {
      const response = await axios.post(`https://docuquery-api-idh9.onrender.com/api/documents/${documentId}/query`, {
        question: question
      });
      setAnswer(response.data.answer);
    } catch (error) {
      alert("Query failed: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* LEFT PANEL: INGESTION */}
      <div className="left-panel">
        <div className="header-title">
          <FileText color="#2563eb" /> DocuQuery AI
        </div>
        
        <p style={{color: '#64748b', fontSize: '0.9rem'}}>
          Upload enterprise documents to extract structured metadata and query via LangChain RAG.
        </p>

        <div className="upload-box">
          <input 
            type="file" 
            accept=".pdf"
            onChange={(e) => setFile(e.target.files[0])} 
            style={{marginBottom: '1rem'}}
          />
          <button 
            className="btn" 
            onClick={handleUpload} 
            disabled={!file || loading}
          >
            {loading && !documentId ? <Loader2 className="lucide-spin" /> : <FileUp />}
            Upload & Process
          </button>
        </div>

        {documentId && (
          <div className="success-box">
            <strong>✓ Document Ingested Successfully</strong><br/>
            ID: {documentId}
          </div>
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
            RAG Chat
          </div>
        </div>

        <div className="content-card">
          {!documentId ? (
            <div style={{color: '#94a3b8', textAlign: 'center', marginTop: '2rem'}}>
              Please upload a document first to unlock AI features.
            </div>
          ) : (
            <>
              {/* SUMMARY TAB */}
              {activeTab === 'summary' && (
                <div>
                  <button className="btn" onClick={handleGetSummary} disabled={loading}>
                    {loading && !summary ? <Loader2 className="lucide-spin"/> : null} 
                    Generate JSON Metadata
                  </button>
                  
                  {summary && (
                    <div style={{marginTop: '1.5rem'}}>
                      <h3 style={{marginBottom: '0.5rem'}}>Document Type:</h3>
                      <p style={{color: '#2563eb', fontWeight: 'bold'}}>{summary.documentType}</p>
                      
                      <h3 style={{marginTop: '1rem', marginBottom: '0.5rem'}}>Summary:</h3>
                      <p>{summary.shortSummary}</p>
                      
                      <h3 style={{marginTop: '1rem', marginBottom: '0.5rem'}}>Key Entities:</h3>
                      <ul style={{paddingLeft: '1.5rem'}}>
                        {summary.keyEntities.map((entity, idx) => (
                          <li key={idx}>{entity}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* CHAT TAB */}
              {activeTab === 'chat' && (
                <div>
                  <div className="chat-input-group">
                    <input 
                      type="text" 
                      className="chat-input"
                      placeholder="Ask a question about the document..."
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                    />
                    <button 
                      className="btn" 
                      style={{width: 'auto'}} 
                      onClick={handleAskQuestion}
                      disabled={!question.trim() || loading}
                    >
                      {loading && !answer ? <Loader2 className="lucide-spin"/> : <Send size={18}/>}
                    </button>
                  </div>

                  {answer && (
                    <div className="answer-box">
                      <strong>AI Assistant:</strong><br/><br/>
                      {answer}
                    </div>
                  )}
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