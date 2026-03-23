// SVG renderer for sequence diagrams
import { marked } from 'marked';

const CONFIG = {
  actorWidth: 120,
  actorHeight: 40,
  actorPadding: 60,
  messageHeight: 50,
  noteMinHeight: 60,
  sectionPadding: 20,
  leftMargin: 40,
  topMargin: 20,
  arrowSize: 8
};

export function render(ast) {
  const ctx = {
    actors: ast.actors,
    actorOrder: ast.actors.slice(),
    x: CONFIG.leftMargin,
    y: CONFIG.topMargin,
    messageNum: ast.autonumber ? 1 : 0,
    backgroundElements: [],
    elements: [],
    title: ast.title
  };

  // Calculate total width first
  const totalWidth = ctx.actorOrder.length * (CONFIG.actorWidth + CONFIG.actorPadding) + CONFIG.leftMargin * 2;

  // Render actor boxes at top
  renderActors(ctx, ctx.y);

  // Start lifelines
  ctx.y += CONFIG.actorHeight + 20;
  const lifelineStart = ctx.y;

  // Render lifelines to background
  ctx.actorOrder.forEach((actor, i) => {
    const x = getActorX(ctx, actor);
    ctx.backgroundElements.push({
      type: 'line',
      x1: x,
      y1: lifelineStart,
      x2: x,
      y2: 0, // Will update later
      className: 'lifeline'
    });
  });

  // Process elements
  processElements(ast.elements, ctx, 0);

  // Update lifeline heights
  ctx.backgroundElements.forEach(line => {
    if (line.type === 'line' && line.className === 'lifeline') {
      line.y2 = ctx.y;
    }
  });

  // Add padding before bottom actors (matching top)
  ctx.y += 20;

  // Render actor boxes at bottom
  renderActors(ctx, ctx.y);

  // Calculate total height after bottom actors
  const totalHeight = ctx.y + CONFIG.actorHeight + 40;

  // Combine: backgrounds first, then foreground elements
  const allElements = [...ctx.backgroundElements, ...ctx.elements];

  return { elements: allElements, width: totalWidth, height: totalHeight, title: ast.title };
}

function renderActors(ctx, y) {
  ctx.actorOrder.forEach((actor, i) => {
    const x = ctx.x + i * (CONFIG.actorWidth + CONFIG.actorPadding);
    
    // Check if this is the Green Dot logo actor
    if (actor === 'Green Dot') {
      // Don't render the box for logo actors
      ctx.elements.push({
        type: 'actor-image',
        x,
        y,
        width: CONFIG.actorWidth,
        height: CONFIG.actorHeight,
        image: '/greendot-white-bg.jpg',
        actor
      });
    } else {
      ctx.elements.push({
        type: 'rect',
        x,
        y,
        width: CONFIG.actorWidth,
        height: CONFIG.actorHeight,
        className: 'actor'
      });
      ctx.elements.push({
        type: 'text',
        x: x + CONFIG.actorWidth / 2,
        y: y + CONFIG.actorHeight / 2,
        text: actor,
        className: 'actor-text'
      });
    }
  });
}

function processElements(elements, ctx, indent) {
  elements.forEach(element => {
    switch (element.type) {
      case 'message':
        renderMessage(ctx, element, indent);
        break;
      case 'note':
        renderNote(ctx, element, indent);
        break;
      case 'divider':
        renderDivider(ctx, element);
        break;
      case 'delay':
        renderDelay(ctx, element);
        break;
      case 'if':
      case 'group':
        renderSection(ctx, element, indent);
        break;
      case 'order':
        ctx.actorOrder = element.order;
        break;
    }
  });
}

function renderMessage(ctx, msg, indent) {
  const fromX = getActorX(ctx, msg.from);
  const toX = getActorX(ctx, msg.to);

  const arrow = getArrowStyle(msg.arrow);
  const rawLabel = ctx.messageNum > 0 ? `${ctx.messageNum}. ${msg.text}` : msg.text;
  const label = processMarkdown(rawLabel);

  // Calculate label height based on text length and arrow width
  const arrowWidth = Math.abs(toX - fromX);
  const textLength = msg.text.length;
  const charsPerLine = Math.max(20, Math.floor(arrowWidth / 7)); // ~7px per char
  const estimatedLines = Math.ceil(textLength / charsPerLine);
  const labelHeight = estimatedLines * 18; // 18px per line (font-size 12px + line-height)

  // Position arrow below the label
  const y = ctx.y + labelHeight + 10;

  // Check if this is a self-referencing message
  if (msg.from === msg.to) {
    ctx.elements.push({
      type: 'self-arrow',
      x: fromX,
      y: y,
      label,
      labelHeight,
      sourceLineNum: msg.sourceLineNum,
      ...arrow,
      indent
    });
    // Self-loops need extra vertical space for the loop
    ctx.y += labelHeight + CONFIG.messageHeight + 20;
  } else {
    ctx.elements.push({
      type: 'arrow',
      x1: fromX,
      y1: y,
      x2: toX,
      y2: y,
      label,
      labelHeight,
      sourceLineNum: msg.sourceLineNum,
      ...arrow,
      indent
    });
    ctx.y += labelHeight + 20; // Label height + spacing
  }

  if (ctx.messageNum > 0) ctx.messageNum++;
}

function renderNote(ctx, note, indent) {
  const text = processMarkdown(note.text);
  const lines = text.split('\n').length;
  const height = Math.max(CONFIG.noteMinHeight, lines * 24 + 30);

  let x, width;
  if (note.fullWidth) {
    // Full width: span from first to last actor
    const x1 = getActorX(ctx, ctx.actorOrder[0]);
    const x2 = getActorX(ctx, ctx.actorOrder[ctx.actorOrder.length - 1]);
    x = x1 - CONFIG.actorWidth / 2;
    width = x2 - x1 + CONFIG.actorWidth;
  } else if (note.startActor && note.endActor) {
    const x1 = getActorX(ctx, note.startActor);
    const x2 = getActorX(ctx, note.endActor);
    x = Math.min(x1, x2) - CONFIG.actorWidth / 2;
    width = Math.abs(x2 - x1) + CONFIG.actorWidth;
  } else {
    // Use previous message width if available
    const prevElement = ctx.elements[ctx.elements.length - 1];
    if (prevElement && prevElement.type === 'arrow') {
      x = Math.min(prevElement.x1, prevElement.x2) - 10;
      width = Math.abs(prevElement.x2 - prevElement.x1) + 20;
    } else {
      x = ctx.x;
      width = CONFIG.actorWidth * 2;
    }
  }

  ctx.elements.push({
    type: 'note',
    x,
    y: ctx.y,
    width,
    height,
    text,
    indent,
    noteType: note.noteType || 'default',
    sourceLineNum: note.sourceLineNum
  });

  ctx.y += height + 10;
}

function renderDivider(ctx, divider) {
  const width = ctx.actorOrder.length * (CONFIG.actorWidth + CONFIG.actorPadding);
  const style = divider.style === '=' ? 'bold' : divider.style === '-' ? 'dashed' : 'thin';
  
  // Add double spacing before section headers (dividers with labels)
  if (divider.label && divider.label.trim()) {
    ctx.y += CONFIG.messageHeight;
  }
  
  ctx.elements.push({
    type: 'divider',
    x: ctx.x,
    y: ctx.y + 15,
    width,
    label: processMarkdown(divider.label),
    style
  });

  ctx.y += 30;
}

function renderDelay(ctx, delay) {
  const width = ctx.actorOrder.length * (CONFIG.actorWidth + CONFIG.actorPadding);
  
  ctx.elements.push({
    type: 'delay',
    x: ctx.x,
    y: ctx.y,
    width,
    height: 80,
    label: delay.label || ''
  });
  ctx.y += 80;
}

function renderSection(ctx, section, indent) {
  const startY = ctx.y;
  const sectionX = ctx.x - 10 + indent * CONFIG.sectionPadding;

  // Add section box to background first
  const width = ctx.actorOrder.length * (CONFIG.actorWidth + CONFIG.actorPadding) + 20;
  const sectionBox = {
    type: 'section',
    x: sectionX,
    y: startY,
    width,
    height: 0, // Will update later
    label: processMarkdown(section.label),
    sectionType: section.type
  };
  ctx.backgroundElements.push(sectionBox);

  ctx.y += 25;
  processElements(section.elements, ctx, indent + 1);

  if (section.alternatives) {
    section.alternatives.forEach(alt => {
      const altY = ctx.y;
      ctx.y += 25;
      processElements(alt.elements, ctx, indent + 1);
      
      // Render else divider
      ctx.elements.push({
        type: 'section-divider',
        x: sectionX,
        y: altY,
        width: ctx.actorOrder.length * (CONFIG.actorWidth + CONFIG.actorPadding) + 20,
        label: processMarkdown(alt.label)
      });
    });
  }

  const endY = ctx.y + 10;
  
  // Update section box height
  sectionBox.height = endY - startY;

  // Add spacing after section consistent with message spacing
  ctx.y = endY + CONFIG.messageHeight - 10;
}

function getActorX(ctx, actorName) {
  const index = ctx.actorOrder.indexOf(actorName);
  return ctx.x + index * (CONFIG.actorWidth + CONFIG.actorPadding) + CONFIG.actorWidth / 2;
}

function getArrowStyle(arrow) {
  const style = {
    dashed: arrow.includes('--'),
    bold: arrow.includes('='),
    open: arrow.includes('>>') || arrow.includes('<<'),
    bidirectional: arrow.includes('<->'),
    lost: arrow.includes('-x'),
    funds: arrow.startsWith('$')
  };
  return style;
}

function processMarkdown(text) {
  if (!text) return '';
  
  // Convert Font Awesome icons
  text = text.replace(/\{(fa[bslrd])-([^}]+)\}/g, '<i class="$1 fa-$2"></i>');
  
  // Convert links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Simple markdown inline processing
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  return text;
}
