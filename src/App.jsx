import { useState, useEffect } from 'react';
import { parse } from './parser';
import { render } from './renderer';
import DiagramRenderer from './DiagramRenderer';
import Library from './Library';
import './App.css';

const DEFAULT_DIAGRAM = `title: Green Dot Swimlanes

note:
**Welcome to Green Dot Swimlanes**
A secure, behind-the-firewall sequence diagram tool.

Edit the text on the left to see your diagram update in real-time.

Client -> API: Request
API -> Database: Query
Database --> API: Results
API --> Client: Response

note: Simple and powerful syntax for sequence diagrams`;

const NEW_DIAGRAM = `title: New Diagram

Green Dot -> Partner: Request`;

function App() {
  const [text, setText] = useState(() => {
    return localStorage.getItem('swimlanes-text') || DEFAULT_DIAGRAM;
  });
  const [diagram, setDiagram] = useState(null);
  const [error, setError] = useState(null);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [currentFilename, setCurrentFilename] = useState(() => {
    return localStorage.getItem('swimlanes-current-file') || null;
  });
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedText, setLastSavedText] = useState('');

  useEffect(() => {
    try {
      const ast = parse(text);
      const rendered = render(ast);
      setDiagram(rendered);
      setError(null);
      localStorage.setItem('swimlanes-text', text);
      
      // Check if there are unsaved changes
      if (text !== lastSavedText) {
        setHasUnsavedChanges(true);
      }
    } catch (err) {
      setError(err.message);
      setDiagram(null);
    }
  }, [text, lastSavedText]);

  const saveDiagram = async (content) => {
    try {
      const response = await fetch('/api/diagrams/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, currentFilename })
      });
      const data = await response.json();
      if (data.filename) {
        setCurrentFilename(data.filename);
        localStorage.setItem('swimlanes-current-file', data.filename);
        setLastSaved(new Date());
        setLastSavedText(content);
        setHasUnsavedChanges(false);
      }
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save diagram');
    }
  };

  const handleSave = () => {
    saveDiagram(text);
  };

  const handleExport = () => {
    if (!diagram) return;
    
    const svgElement = document.querySelector('.sequence-diagram');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diagram.svg';
    link.click();
    
    URL.revokeObjectURL(url);
  };

  const handleNew = () => {
    if (confirm('Create a new diagram? Current diagram will be replaced.')) {
      setText(NEW_DIAGRAM);
      setCurrentFilename(null);
      localStorage.removeItem('swimlanes-current-file');
      setLastSavedText('');
      setHasUnsavedChanges(false);
    }
  };

  const handleLibrary = () => {
    setShowLibrary(!showLibrary);
  };

  const handleLoadDiagram = (content) => {
    setText(content);
    setCurrentFilename(null); // Will be set on first save
    localStorage.removeItem('swimlanes-current-file');
    setLastSavedText('');
    setHasUnsavedChanges(false);
  };

  const handleLoadExample = () => {
    fetch('/syntax-guide.txt')
      .then(res => res.text())
      .then(content => setText(content))
      .catch(err => {
        console.error('Failed to load syntax guide:', err);
        setText(FULL_SYNTAX_EXAMPLE);
      });
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-logo">
          <img src="/greendot-dark-bg.png" alt="Green Dot" />
          <span>Swimlanes</span>
        </div>
        <div className="header-actions">
          <button onClick={handleNew} title="Create new diagram">
            ➕ New
          </button>
          <button onClick={handleSave} disabled={!hasUnsavedChanges} title="Save diagram">
            💾 Save
          </button>
          <button onClick={handleLibrary} title="View saved diagrams">
            📚 Library
          </button>
          <button onClick={handleLoadExample} title="Load syntax guide">
            📖 Syntax Guide
          </button>
          <button onClick={handleExport} disabled={!diagram} title="Export as SVG">
            📥 Export SVG
          </button>
        </div>
      </header>

      <div className="editor-container">
        <div className={`editor-panel ${editorCollapsed ? 'collapsed' : ''}`}>
          {!editorCollapsed ? (
            <>
              <div className="panel-header">
                Editor
                <button 
                  className="collapse-btn editor-active" 
                  onClick={() => setEditorCollapsed(true)}
                  title="Hide editor"
                >
                  ✏️
                </button>
              </div>
              <textarea
                className="editor"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                placeholder="Enter your swimlanes syntax here..."
              />
              {error && <div className="error">{error}</div>}
            </>
          ) : (
            <div className="panel-header collapsed-header">
              <button 
                className="collapse-btn editor-collapsed" 
                onClick={() => setEditorCollapsed(false)}
                title="Show editor"
              >
                ✏️
              </button>
            </div>
          )}
        </div>

        <div className="diagram-panel">
          <div className="panel-header">
            <span>{diagram?.title || 'Diagram'}</span>
            {lastSaved && (
              <span className="autosave-indicator">
                Saved at {lastSaved.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="diagram-container">
            <DiagramRenderer diagram={diagram} />
          </div>
        </div>
      </div>

      {showLibrary && (
        <Library 
          onClose={() => setShowLibrary(false)} 
          onLoad={handleLoadDiagram} 
        />
      )}
    </div>
  );
}

const FULL_SYNTAX_EXAMPLE = `title: Swimlanes Full Syntax

_: **1. Messages**
One -> Two: Simple
Two ->> Three: Open arrow 
Three -x Four: Lost message

Three <-> Four: Bi-directional
Two -> Two: To self

Two -> One: Actors can be
One <- Two: in any order

Two -> Three: Regular
Two <-- Three: Dashed 
Two => Three: Bold

One -> Four: **Bold**, *Italic*, ~~strike~~ and \`code\`

note: Add sequence numbers with **autonumber**
// autonumber

_: **2. Notes**

note:
Simple text formatting: **bold**, *italic*, ~~strike~~ and \`inline code\`

Two -> Three: A note is closed by a following element

note: A note spans the previous message by default

note One, Three: Specify actors to change width

_: **3. Sections**

if: Conditional flows with **if**
  Two -> Three: Message
else: Alternative flow with **else**
  Two -> One: Message
end

group: Simple grouping with **group**
  One -> Two: Message
end

_: **4. Dividers**

_: thin
-: regular
--: dashed
=: bold

_: **5. Delay**

...: Indicate a delay

_: **6. Order**
note: Change actor order with **order**
// order: Three, Two, One, Four
`;

export default App;
