import { useState, useEffect, useRef } from 'react';
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
  const textareaRef = useRef(null);

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

  // Autosave every 30 seconds
  useEffect(() => {
    if (!currentFilename || !hasUnsavedChanges) return; // Only autosave if we have a file and changes
    
    const autoSaveTimer = setInterval(() => {
      if (hasUnsavedChanges) {
        saveDiagram(text);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveTimer);
  }, [currentFilename, hasUnsavedChanges, text]);

  const saveDiagram = async (content) => {
    // Safety check: don't save if no current filename (e.g., Syntax Guide)
    if (!currentFilename) {
      console.log('No filename set - creating new diagram file');
      // This should only happen on first save after "New" button
      const timestamp = Date.now();
      const newFilename = `diagram-${timestamp}.txt`;
      
      try {
        const response = await fetch('/api/diagrams/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, filename: newFilename })
        });
        const data = await response.json();
        if (data.success) {
          setCurrentFilename(newFilename);
          localStorage.setItem('swimlanes-current-file', newFilename);
          setLastSaved(new Date());
          setLastSavedText(content);
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error('Failed to save:', err);
        alert('Failed to save diagram');
      }
      return;
    }
    
    // Update existing file
    try {
      const response = await fetch('/api/diagrams/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filename: currentFilename })
      });
      const data = await response.json();
      if (data.success) {
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
      const timestamp = Date.now();
      const newFilename = `diagram-${timestamp}.txt`;
      
      setText(NEW_DIAGRAM);
      setCurrentFilename(newFilename);
      localStorage.setItem('swimlanes-current-file', newFilename);
      setLastSavedText('');
      setHasUnsavedChanges(true); // Mark as having changes so it will save
    }
  };

  const handleLibrary = () => {
    setShowLibrary(!showLibrary);
  };

  const handleLoadDiagram = (content, filename) => {
    setText(content);
    setCurrentFilename(filename); // Set the filename so updates save to same file
    localStorage.setItem('swimlanes-current-file', filename);
    setLastSavedText(content);
    setHasUnsavedChanges(false);
  };

  const handleLoadExample = () => {
    fetch('/syntax-guide.txt')
      .then(res => res.text())
      .then(content => {
        setText(content);
        setCurrentFilename(null); // Syntax guide is not saveable
        localStorage.removeItem('swimlanes-current-file');
        setLastSavedText('');
        setHasUnsavedChanges(false);
      })
      .catch(err => {
        console.error('Failed to load syntax guide:', err);
        setText(FULL_SYNTAX_EXAMPLE);
      });
  };

  const handleElementClick = (sourceLineNum) => {
    console.log('Element clicked, line:', sourceLineNum);
    if (sourceLineNum === undefined || !textareaRef.current) return;
    
    // Expand editor if collapsed
    if (editorCollapsed) {
      setEditorCollapsed(false);
    }
    
    // Focus and select the line in the textarea
    const lines = text.split('\n');
    let charPosition = 0;
    for (let i = 0; i < sourceLineNum; i++) {
      charPosition += lines[i].length + 1; // +1 for newline
    }
    
    const lineLength = lines[sourceLineNum]?.length || 0;
    
    setTimeout(() => {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charPosition, charPosition + lineLength);
      textareaRef.current.scrollTop = Math.max(0, sourceLineNum * 20 - 100);
    }, 100);
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
          <button onClick={handleSave} disabled={!hasUnsavedChanges || !currentFilename} title="Save diagram" style={{ display: currentFilename ? 'inline-block' : 'none' }}>
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
                ref={textareaRef}
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
            <DiagramRenderer diagram={diagram} onElementClick={handleElementClick} />
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
