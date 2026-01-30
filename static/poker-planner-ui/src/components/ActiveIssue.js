import React, { useEffect, useState, useRef } from 'react';
import { requestJira } from '@forge/bridge';
import Button, { ButtonGroup } from '@atlaskit/button';
import BoldIcon from '@atlaskit/icon/glyph/editor/bold';
import ItalicIcon from '@atlaskit/icon/glyph/editor/italic';
import UnderlineIcon from '@atlaskit/icon/glyph/editor/underline';
import StrikethroughIcon from '@atlaskit/icon/glyph/editor/strikethrough';
import BulletListIcon from '@atlaskit/icon/glyph/editor/bullet-list';
import NumberListIcon from '@atlaskit/icon/glyph/editor/number-list';
import AlignLeftIcon from '@atlaskit/icon/glyph/editor/align-left';
import AlignCenterIcon from '@atlaskit/icon/glyph/editor/align-center';
import AlignRightIcon from '@atlaskit/icon/glyph/editor/align-right';
import CodeIcon from '@atlaskit/icon/glyph/editor/code';
import QuoteIcon from '@atlaskit/icon/glyph/editor/quote';
import LinkIcon from '@atlaskit/icon/glyph/editor/link';
import UndoIcon from '@atlaskit/icon/glyph/editor/undo';
import RedoIcon from '@atlaskit/icon/glyph/editor/redo';
import TextStyleIcon from '@atlaskit/icon/glyph/editor/text-style';
import HorizontalRuleIcon from '@atlaskit/icon/glyph/editor/horizontal-rule';

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

                 // Auto-Enable Edit Mode for Moderator
                 if (isEditable) {
                    setEditing(true);
                 }
             }
           } catch(e) { console.error(e); }
        };
        fetchIssue();
    } else {
        setIssue(null);
    }
  }, [targetIssueId, isEditable]);

  // Sync editor content when issue changes (initial load), but NOT on every keystroke
  useEffect(() => {
    if (editorRef.current && issue && form.description) {
        editorRef.current.innerText = form.description;
    }
  }, [issue]);

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
                   speed={5} 
                   style={{ 
                       margin: 0, 
                       fontSize: '0.9rem', 
                       color: 'var(--text-muted)', 
                       whiteSpace: 'pre-wrap', 
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
       
       {/* Modern Rich Text Toolbar */}
       <div style={{ 
           display: 'flex', 
           gap: 4, 
           padding: '8px', 
           background: 'var(--surface)', 
           borderRadius: 4,
           borderBottom: '1px solid var(--border)',
           flexWrap: 'wrap',
           width: '100%',
           alignItems: 'center'
       }}>
           <ButtonGroup>
             <Button iconBefore={<BoldIcon label="Bold" />} appearance="subtle" onClick={() => applyFormat('bold')} spacing="none" />
             <Button iconBefore={<ItalicIcon label="Italic" />} appearance="subtle" onClick={() => applyFormat('italic')} spacing="none" />
             <Button iconBefore={<UnderlineIcon label="Underline" />} appearance="subtle" onClick={() => applyFormat('underline')} spacing="none" />
             <Button iconBefore={<StrikethroughIcon label="Strikethrough" />} appearance="subtle" onClick={() => applyFormat('strikeThrough')} spacing="none" />
           </ButtonGroup>
           
           <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 8px' }} />
           
           <ButtonGroup>
               <Button appearance="subtle" onClick={() => applyFormat('formatBlock', '<h1>')} spacing="compact">H1</Button>
               <Button appearance="subtle" onClick={() => applyFormat('formatBlock', '<h2>')} spacing="compact">H2</Button>
               <Button iconBefore={<TextStyleIcon label="Styles" />} appearance="subtle" onClick={() => applyFormat('formatBlock', '<p>')} spacing="none" />
           </ButtonGroup>

           <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 8px' }} />

           <ButtonGroup>
               <Button iconBefore={<BulletListIcon label="Bullet List" />} appearance="subtle" onClick={() => applyFormat('insertUnorderedList')} spacing="none" />
               <Button iconBefore={<NumberListIcon label="Number List" />} appearance="subtle" onClick={() => applyFormat('insertOrderedList')} spacing="none" />
           </ButtonGroup>

           <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 8px' }} />

           <ButtonGroup>
               <Button iconBefore={<AlignLeftIcon label="Align Left" />} appearance="subtle" onClick={() => applyFormat('justifyLeft')} spacing="none" />
               <Button iconBefore={<AlignCenterIcon label="Align Center" />} appearance="subtle" onClick={() => applyFormat('justifyCenter')} spacing="none" />
               <Button iconBefore={<AlignRightIcon label="Align Right" />} appearance="subtle" onClick={() => applyFormat('justifyRight')} spacing="none" />
           </ButtonGroup>

           <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 8px' }} />

           <Button iconBefore={<CodeIcon label="Code" />} appearance="subtle" onClick={() => applyFormat('formatBlock', '<pre>')} spacing="none" />
           <Button iconBefore={<QuoteIcon label="Quote" />} appearance="subtle" onClick={() => applyFormat('formatBlock', 'blockquote')} spacing="none" />
           <Button iconBefore={<LinkIcon label="Link" />} appearance="subtle" onClick={() => {
                const url = prompt('Enter URL:');
                if (url) applyFormat('createLink', url);
           }} spacing="none" />
           <Button iconBefore={<HorizontalRuleIcon label="Horizontal Rule" />} appearance="subtle" onClick={() => applyFormat('insertHorizontalRule')} spacing="none" />

           <div style={{ flex: 1 }} />
           
           <ButtonGroup>
               <Button iconBefore={<UndoIcon label="Undo" />} appearance="subtle" onClick={() => applyFormat('undo')} spacing="none" />
               <Button iconBefore={<RedoIcon label="Redo" />} appearance="subtle" onClick={() => applyFormat('redo')} spacing="none" />
           </ButtonGroup>
       </div>
       
       <div
           ref={editorRef}
           contentEditable
           suppressContentEditableWarning
           onInput={(e) => setForm({...form, description: e.currentTarget.innerText})}
           style={{ 
               width: '100%', 
               minHeight: 120,
               padding: 12, 
               borderRadius: '0 0 4px 4px', 
               border: '1px solid var(--border)', 
               borderTop: 'none',
               background: 'var(--ds-background-input, #fff)', 
               color: 'var(--text-main)', 
               fontFamily: 'inherit',
               outline: 'none',
               overflowY: 'auto',
               maxHeight: 300,
               marginTop: -4 // overlap with toolbar border
           }}
       />
       
       <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end', marginTop: 8 }}>
           <button onClick={() => setEditing(false)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
           <button onClick={handleSave} style={{ padding: '6px 12px', background: 'var(--primary)', border: 'none', borderRadius: 4, color: 'var(--primary-text)', cursor: 'pointer', fontWeight: 600 }}>Save</button>
       </div>
    </div>
  );
};

export default ActiveIssue;
