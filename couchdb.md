# Example Crud Operations

```
import React, { useState, useEffect } from 'react';

function App() {
  const [docs, setDocs] = useState([]);
  const [inputValue, setInputValue] = useState('');

  // 1. Read all docs
  const fetchAllDocs = async () => {
    try {
      // GET /couchdb/mydb/_all_docs?include_docs=true
      const response = await fetch('/couchdb/mydb/_all_docs?include_docs=true');
      const data = await response.json();
      if (data.rows) {
        setDocs(data.rows.map(row => row.doc));
      }
    } catch (err) {
      console.error('Error fetching docs:', err);
    }
  };

  // 2. Create a new doc
  const createDoc = async () => {
    // POST /couchdb/mydb
    try {
      const response = await fetch('/couchdb/mydb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: inputValue })
      });
      await response.json();
      fetchAllDocs(); // Refresh docs
      setInputValue('');
    } catch (err) {
      console.error('Error creating doc:', err);
    }
  };

  // 3. Update a doc
  const updateDoc = async (doc) => {
    // PUT /couchdb/mydb/{doc._id}?rev={doc._rev}
    // Typically we pass updated fields, e.g. doc.value
    try {
      doc.value = doc.value + ' (updated)';
      const response = await fetch(`/couchdb/mydb/${doc._id}?rev=${doc._rev}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc)
      });
      await response.json();
      fetchAllDocs();
    } catch (err) {
      console.error('Error updating doc:', err);
    }
  };

  // 4. Delete a doc
  const deleteDoc = async (doc) => {
    // DELETE /couchdb/mydb/{doc._id}?rev={doc._rev}
    try {
      await fetch(`/couchdb/mydb/${doc._id}?rev=${doc._rev}`, { method: 'DELETE' });
      fetchAllDocs();
    } catch (err) {
      console.error('Error deleting doc:', err);
    }
  };

  useEffect(() => {
    fetchAllDocs();
  }, []);

  return (
    <div style={{ margin: 20 }}>
      <h1>My CouchDB CRUD Demo</h1>
      <div style={{ marginBottom: 20 }}>
        <input 
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="New doc value"
        />
        <button onClick={createDoc}>Create Doc</button>
      </div>

      <ul>
        {docs.map(doc => (
          <li key={doc._id} style={{ marginBottom: 10 }}>
            <strong>ID:</strong> {doc._id} <br />
            <strong>Rev:</strong> {doc._rev} <br />
            <strong>Value:</strong> {doc.value} <br />
            <button onClick={() => updateDoc(doc)}>Update</button>
            <button onClick={() => deleteDoc(doc)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
```