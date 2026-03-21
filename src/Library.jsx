import { useState, useEffect } from 'react';
import './Library.css';

function Library({ onClose, onLoad }) {
  const [diagrams, setDiagrams] = useState([]);
  const [filteredDiagrams, setFilteredDiagrams] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiagrams();
  }, []);

  useEffect(() => {
    let filtered = diagrams.filter(d => 
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(b.modified) - new Date(a.modified);
      } else {
        comparison = a.title.localeCompare(b.title);
      }
      return sortOrder === 'desc' ? comparison : -comparison;
    });

    setFilteredDiagrams(filtered);
  }, [diagrams, searchTerm, sortBy, sortOrder]);

  const loadDiagrams = async () => {
    try {
      const response = await fetch('/api/diagrams');
      const data = await response.json();
      setDiagrams(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load diagrams:', err);
      setLoading(false);
    }
  };

  const handleDelete = async (filename) => {
    if (!confirm(`Delete "${filename}"?`)) return;

    try {
      await fetch(`/api/diagrams/${filename}`, { method: 'DELETE' });
      loadDiagrams();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleLoad = (content) => {
    onLoad(content);
    onClose();
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="library-overlay" onClick={onClose}>
      <div className="library-panel" onClick={(e) => e.stopPropagation()}>
        <div className="library-header">
          <h2>📚 Diagram Library</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="library-search">
          <input
            type="text"
            placeholder="🔍 Search diagrams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="library-loading">Loading...</div>
        ) : (
          <div className="library-content">
            <table className="diagrams-table">
              <thead>
                <tr>
                  <th onClick={() => toggleSort('name')} className="sortable">
                    Name {sortBy === 'name' && (sortOrder === 'desc' ? '▼' : '▲')}
                  </th>
                  <th onClick={() => toggleSort('date')} className="sortable">
                    Last Modified {sortBy === 'date' && (sortOrder === 'desc' ? '▼' : '▲')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiagrams.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="empty-message">
                      {searchTerm ? 'No diagrams found' : 'No saved diagrams yet'}
                    </td>
                  </tr>
                ) : (
                  filteredDiagrams.map((d) => (
                    <tr key={d.filename} onClick={() => handleLoad(d.content)} className="diagram-row">
                      <td className="diagram-title">{d.title}</td>
                      <td className="diagram-date">{formatDate(d.modified)}</td>
                      <td className="diagram-actions">
                        <button
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(d.filename);
                          }}
                          title="Delete diagram"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Library;
