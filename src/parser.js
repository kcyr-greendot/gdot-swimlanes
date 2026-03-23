// Swimlanes syntax parser
export function parse(text) {
  const lines = text.split('\n');
  const ast = {
    title: '',
    actors: new Set(),
    elements: [],
    autonumber: false
  };

  let lineNum = 0;
  let sectionStack = [];

  while (lineNum < lines.length) {
    const line = lines[lineNum].trim();
    const lineLower = line.toLowerCase();
    const sourceLineNum = lineNum; // Track original line number (0-indexed)
    lineNum++;

    if (!line || line.startsWith('//')) continue;

    // Title
    if (lineLower.startsWith('title:')) {
      ast.title = line.substring(6).trim();
      continue;
    }

    // Autonumber
    if (lineLower === 'autonumber') {
      ast.autonumber = true;
      continue;
    }

    // Order
    if (lineLower.startsWith('order:')) {
      const order = line.substring(6).split(',').map(s => s.trim());
      ast.elements.push({ type: 'order', order });
      continue;
    }

    // Delay
    if (line.startsWith('...')) {
      const label = line.substring(3).replace(/^:\s*/, '').trim();
      ast.elements.push({ type: 'delay', label });
      continue;
    }

    // Sections
    if (lineLower.startsWith('if:') || lineLower.startsWith('group:')) {
      const type = lineLower.startsWith('if:') ? 'if' : 'group';
      const label = line.substring(line.indexOf(':') + 1).trim();
      const section = { type, label, elements: [] };
      ast.elements.push(section);
      sectionStack.push(section);
      continue;
    }

    if (lineLower.startsWith('else:') || lineLower === 'else') {
      if (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].type === 'if') {
        const label = line.includes(':') ? line.substring(line.indexOf(':') + 1).trim() : '';
        const elseSection = { type: 'else', label, elements: [] };
        const parent = sectionStack[sectionStack.length - 1];
        if (!parent.alternatives) parent.alternatives = [];
        parent.alternatives.push(elseSection);
        sectionStack[sectionStack.length - 1] = elseSection;
      }
      continue;
    }

    if (lineLower === 'end') {
      if (sectionStack.length > 0) {
        sectionStack.pop();
      }
      continue;
    }

    // Dividers
    if (/^[_\-=]+:?\s*/.test(line) && !line.includes('>') && !line.includes('<')) {
      const match = line.match(/^([_\-=]+):?\s*(.*)/);
      if (match) {
        const style = match[1][0];
        const label = match[2];
        const element = { type: 'divider', style, label, sourceLineNum };
        addElement(ast, sectionStack, element);
        continue;
      }
    }

    // Notes
    if (lineLower.startsWith('note:') || lineLower.startsWith('note ') || lineLower.startsWith('note[') ||
        lineLower.startsWith('note-i:') || lineLower.startsWith('note-i[') || lineLower.startsWith('note-i ') ||
        lineLower.startsWith('note-!:') || lineLower.startsWith('note-![') || lineLower.startsWith('note-! ') ||
        lineLower.startsWith('note-x:') || lineLower.startsWith('note-x[') || lineLower.startsWith('note-x ')) {
      let content = line.substring(4).trim();
      let fullWidth = false;
      let startActor = null, endActor = null;
      let noteType = 'default';
      
      // Check for note type modifier
      if (lineLower.startsWith('note-i')) {
        noteType = 'info';
        content = line.substring(6).trim();
      } else if (lineLower.startsWith('note-!')) {
        noteType = 'caution';
        content = line.substring(6).trim();
      } else if (lineLower.startsWith('note-x')) {
        noteType = 'warning';
        content = line.substring(6).trim();
      }
      
      // Check for [full] modifier
      if (content.toLowerCase().startsWith('[full]')) {
        fullWidth = true;
        content = content.substring(6).trim();
        if (content.startsWith(':')) {
          content = content.substring(1).trim();
        }
      } else if (content.startsWith(':') || content.startsWith(' ')) {
        content = content.substring(1).trim();
      }
      
      // Check for actor range: "note Actor1, Actor2: text"
      const actorMatch = content.match(/^([^,]+),\s*([^:]+):\s*(.+)/);
      if (actorMatch) {
        startActor = actorMatch[1].trim();
        endActor = actorMatch[2].trim();
        ast.actors.add(startActor);
        ast.actors.add(endActor);
        const noteText = actorMatch[3];
        const element = { type: 'note', text: noteText, startActor, endActor, fullWidth, noteType, sourceLineNum };
        addElement(ast, sectionStack, element);
      } else {
        // Multi-line note - continues until next element tag or 'end'
        const noteLines = [content];
        while (lineNum < lines.length) {
          const nextLine = lines[lineNum];
          const nextLineTrimmed = nextLine.trim();
          const nextLineLower = nextLineTrimmed.toLowerCase();
          
          // Stop if we hit 'end' or a new element tag
          if (nextLineLower === 'end' || (nextLineTrimmed && isNewElement(nextLineTrimmed))) {
            break;
          }
          
          // Include line (even if empty/whitespace)
          noteLines.push(nextLine);
          lineNum++;
        }
        const element = { type: 'note', text: noteLines.join('\n'), fullWidth, noteType, sourceLineNum };
        addElement(ast, sectionStack, element);
      }
      continue;
    }

    // Messages  
    const msgMatch = line.match(/^(.+?)\s*(\$?<?-{1,2}>{1,2}|\$?<?-{1,2}x|\$?<?={1,2}>?|\$?<-?>)\s*([^:]+?):\s*(.+)$/);
    if (msgMatch) {
      const from = msgMatch[1].trim();
      const arrow = msgMatch[2].trim();
      const to = msgMatch[3].trim();
      const text = msgMatch[4].trim();

      ast.actors.add(from);
      ast.actors.add(to);

      const element = {
        type: 'message',
        from,
        to,
        arrow,
        text,
        sourceLineNum
      };

      addElement(ast, sectionStack, element);
      continue;
    }
  }

  ast.actors = Array.from(ast.actors);
  return ast;
}

function addElement(ast, sectionStack, element) {
  if (sectionStack.length > 0) {
    sectionStack[sectionStack.length - 1].elements.push(element);
  } else {
    ast.elements.push(element);
  }
}

function isNewElement(line) {
  const lineLower = line.toLowerCase();
  return lineLower.startsWith('title:') ||
         lineLower.startsWith('note:') ||
         lineLower.startsWith('note ') ||
         lineLower.startsWith('note[') ||
         lineLower.startsWith('note-i') ||
         lineLower.startsWith('note-!') ||
         lineLower.startsWith('note-x') ||
         lineLower.startsWith('if:') ||
         lineLower.startsWith('else:') ||
         lineLower === 'else' ||
         lineLower === 'end' ||
         lineLower.startsWith('group:') ||
         lineLower.startsWith('order:') ||
         line.startsWith('...') ||
         /^[_\-=]+:?\s*/.test(line) ||
         /->|<-|>>|<<|=>|<->/.test(line);
}
