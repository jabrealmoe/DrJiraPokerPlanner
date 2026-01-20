import React, { useEffect, useState, useRef } from 'react';
import { requestJira } from '@forge/bridge';

// Helper to extract plain text from ADF (Atlassian Document Format)
const extractTextFromADF = (adf) => {
    if (!adf || typeof adf !== 'object') return '';
    
    let text = '';
    
    const traverse = (node) => {
        if (!node) return;
        
        // If it's a text node, add the text
        if (node.type === 'text' && node.text) {
            text += node.text;
        }
        
        // Recursively process content array
        if (Array.isArray(node.content)) {
            node.content.forEach(child => {
                traverse(child);
                // Add spacing after paragraphs, headings, etc.
                if (child.type === 'paragraph' || child.type === 'heading') {
                    text += '\n';
                }
            });
        }
    };
    
    traverse(adf);
    return text.trim();
};

const TypewriterText = ({ text, speed = 10, tagName = 'div', style, className }) => {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      setDisplayed((prev) => {
        if (i >= text.length) {
          clearInterval(timer);
          return text;
        }
        return text.substring(0, i + 1);
      });
      i++;
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  const Tag = tagName;
  return <Tag style={style} className={className}>{displayed}</Tag>;
};

const ActiveIssue = ({ session, isEditable, updateIssue }) => {
  const [issue, setIssue] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ summary: '', description: '' });
  const editorRef = useRef(null);

  // Determine which ID to use: Room Mode (activeIssueId) or Panel Mode (issueId)
  const targetIssueId = session?.activeIssueId || session?.issueId;

  useEffect(() => {
    if (targetIssueId) {
        const fetchIssue = async () => {
           try {
             // Fetch simplified issue data
             const res = await requestJira(`/rest/api/3/issue/${targetIssueId}?fields=summary,description`);
             if (res.ok) {
                 const data = await res.json();
                 setIssue(data);
                 
                 // Extract text from ADF description
                 const descriptionText = typeof data.fields.description === 'string' 
                     ? data.fields.description 
                     : extractTextFromADF(data.fields.description);
                 
                 setForm({ 
                     summary: data.fields.summary, 
                     description: descriptionText
                 });
             }
           } catch(e) { console.error(e); }
        };
        fetchIssue();
    } else {
        setIssue(null);
    }
  }, [targetIssueId]);

  const handleSave = () => {
      if (updateIssue) {
          // Get plain text from editor
          const plainText = editorRef.current?.innerText || form.description;
          
          updateIssue('updateIssue', { 
              issueId: targetIssueId,
              summary: form.summary,
              description: plainText
          });
          // Optimistic update
          setIssue({
              ...issue,
              fields: {
                  ...issue.fields,
                  summary: form.summary,
                  description: plainText
              }
          });
      }
      setEditing(false);
  };

  const applyFormat = (command, value = null) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
  };

  if (!issue) {
      return (
         <div className="issue-panel" style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
            <p>No active issue selected</p>
         </div>
      );
  }



  // VIEW MODE
  if (!editing) {
      return (
        <div className="issue-panel" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12, minHeight: 120 }}>
           <div style={{ display:'flex', alignItems:'center', width: '100%', justifyContent: 'space-between' }}>
               <div style={{ display:'flex', alignItems:'center'}}>
                    <span className="issue-key">{issue.key}</span>
                    <TypewriterText 
                        text={issue.fields.summary} 
                        tagName="h1" 
                        speed={30} // Slower for title 
                        style={{ margin: 0, fontSize: '1.2rem' }} 
                    />
               </div>
               {isEditable && (
                   <button onClick={() => setEditing(true)} style={{ background: 'none', border:'none', cursor:'pointer', fontSize:'1.2rem'}}>✏️</button>
               )}
           </div>
           {form.description && (
               <TypewriterText 
                   text={form.description} 
                   tagName="p"
                   speed={5} // Fast for description
                   style={{ 
                       margin: 0, 
                       fontSize: '0.9rem', 
                       color: 'var(--text-muted)', 
                       whiteSpace: 'pre-wrap', // Preserve newlines
                       lineHeight: '1.5',
                       maxHeight: '70px',
                       overflowY: 'auto',
                       width: '100%',
                       paddingRight: 8
                   }} 
               />
           )}
        </div>
      );
  }

  // EDIT MODE
  return (
    <div className="issue-panel" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
       <div style={{ width: '100%', display: 'flex', gap: 8 }}>
            <span className="issue-key" style={{ height: 'fit-content' }}>{issue.key}</span>
            <input 
                value={form.summary}
                onChange={e => setForm({...form, summary: e.target.value})}
                style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--ds-background-input, #fff)', color: 'var(--text-main)', fontSize: '1.1rem' }}
            />
       </div>
       
       {/* Rich Text Toolbar */}
       <div style={{ 
           display: 'flex', 
           gap: 4, 
           padding: '8px', 
           background: 'var(--surface)', 
           borderRadius: 6,
           border: '1px solid var(--border)',
           flexWrap: 'wrap'
       }}>
           {/* Text Formatting */}
           <button onClick={() => applyFormat('bold')} style={toolbarButtonStyle} title="Bold (Ctrl+B)">
               <strong>B</strong>
           </button>
           <button onClick={() => applyFormat('italic')} style={toolbarButtonStyle} title="Italic (Ctrl+I)">
               <em>I</em>
           </button>
           <button onClick={() => applyFormat('underline')} style={toolbarButtonStyle} title="Underline (Ctrl+U)">
               <u>U</u>
           </button>
           <button onClick={() => applyFormat('strikeThrough')} style={toolbarButtonStyle} title="Strikethrough">
               <s>S</s>
           </button>
           
           <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
           
           {/* Headings */}
           <button onClick={() => applyFormat('formatBlock', '<h1>')} style={toolbarButtonStyle} title="Heading 1">
               H1
           </button>
           <button onClick={() => applyFormat('formatBlock', '<h2>')} style={toolbarButtonStyle} title="Heading 2">
               H2
           </button>
           <button onClick={() => applyFormat('formatBlock', '<h3>')} style={toolbarButtonStyle} title="Heading 3">
               H3
           </button>
           <button onClick={() => applyFormat('formatBlock', '<p>')} style={toolbarButtonStyle} title="Paragraph">
               P
           </button>
           
           <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
           
           {/* Lists */}
           <button onClick={() => applyFormat('insertUnorderedList')} style={toolbarButtonStyle} title="Bullet List">
               • List
           </button>
           <button onClick={() => applyFormat('insertOrderedList')} style={toolbarButtonStyle} title="Numbered List">
               1. List
           </button>
           
           <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
           
           {/* Alignment */}
           <button onClick={() => applyFormat('justifyLeft')} style={toolbarButtonStyle} title="Align Left">
               ⬅
           </button>
           <button onClick={() => applyFormat('justifyCenter')} style={toolbarButtonStyle} title="Align Center">
               ↔
           </button>
           <button onClick={() => applyFormat('justifyRight')} style={toolbarButtonStyle} title="Align Right">
               ➡
           </button>
           
           <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
           
           {/* Special */}
           <button onClick={() => applyFormat('formatBlock', '<pre>')} style={toolbarButtonStyle} title="Code Block">
               {'</>'}
           </button>
           <button onClick={() => applyFormat('formatBlock', 'blockquote')} style={toolbarButtonStyle} title="Quote">
               "
           </button>
           <button onClick={() => applyFormat('insertHorizontalRule')} style={toolbarButtonStyle} title="Horizontal Line">
               ―
           </button>
           <button 
               onClick={() => {
                   const url = prompt('Enter URL:');
                   if (url) applyFormat('createLink', url);
               }} 
               style={toolbarButtonStyle} 
               title="Insert Link"
           >
               🔗
           </button>
           
           <div style={{ width: 1, background: 'var(--border)', margin: '0 4px' }} />
           
           {/* Undo/Redo */}
           <button onClick={() => applyFormat('undo')} style={toolbarButtonStyle} title="Undo (Ctrl+Z)">
               ↶
           </button>
           <button onClick={() => applyFormat('redo')} style={toolbarButtonStyle} title="Redo (Ctrl+Y)">
               ↷
           </button>
       </div>
       
       {/* Rich Text Editor */}
       <div
           ref={editorRef}
           contentEditable
           suppressContentEditableWarning
           onInput={(e) => setForm({...form, description: e.currentTarget.innerText})}
           style={{ 
               width: '100%', 
               minHeight: 100,
               padding: 12, 
               borderRadius: 4, 
               border: '1px solid var(--border)', 
               background: 'var(--ds-background-input, #fff)', 
               color: 'var(--text-main)', 
               fontFamily: 'inherit',
               outline: 'none',
               overflowY: 'auto',
               maxHeight: 200
           }}
           dangerouslySetInnerHTML={{ __html: form.description.replace(/\n/g, '<br>') }}
       />
       
       <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
           <button onClick={() => setEditing(false)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
           <button onClick={handleSave} style={{ padding: '6px 12px', background: 'var(--primary)', border: 'none', borderRadius: 4, color: 'var(--primary-text)', cursor: 'pointer', fontWeight: 600 }}>Save</button>
       </div>
    </div>
  );
};

const toolbarButtonStyle = {
    padding: '4px 8px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: 'var(--text-main)',
    transition: 'all 0.2s'
};

export default ActiveIssue;
