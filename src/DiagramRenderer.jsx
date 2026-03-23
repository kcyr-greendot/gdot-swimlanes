import { useEffect, useRef } from 'react';

const CONFIG = {
  actorWidth: 120,
  actorHeight: 40,
  actorPadding: 60,
  messageHeight: 50,
  leftMargin: 20,
  arrowSize: 8
};

export default function DiagramRenderer({ diagram, onElementClick }) {
  const svgRef = useRef();
  const headerSvgRef = useRef();
  const containerRef = useRef();

  useEffect(() => {
    if (!diagram || !svgRef.current || !headerSvgRef.current) return;
    
    // Render main diagram
    renderSVG(svgRef.current, diagram, onElementClick);
    
    // Render sticky header actors (copy from main diagram)
    renderStickyActors(headerSvgRef.current, diagram);
    
    // Scale to fit container
    const container = containerRef.current;
    const svg = svgRef.current;
    const headerSvg = headerSvgRef.current;
    if (container && svg) {
      const containerWidth = container.clientWidth - 40; // Account for padding
      const diagramWidth = diagram.width;
      
      // Set min/max scale constraints
      const minScale = 0.5;
      const maxScale = 2.0;
      let scale = Math.min(containerWidth / diagramWidth, maxScale);
      scale = Math.max(scale, minScale);
      
      // Apply same scale to both SVGs
      svg.style.transform = `scale(${scale})`;
      svg.style.transformOrigin = 'top left';
      headerSvg.style.transform = `scale(${scale})`;
      headerSvg.style.transformOrigin = 'top left';
      
      // Constrain the sticky header width to match scaled size
      headerSvg.style.maxWidth = `${diagram.width * scale}px`;
      headerSvg.style.display = 'block';
      
      container.style.height = `${diagram.height * scale + 40}px`;
    }
  }, [diagram, onElementClick]);

  if (!diagram) return <div className="diagram-empty">Enter syntax to see diagram</div>;

  return (
    <div ref={containerRef} style={{ overflow: 'auto', padding: '20px', position: 'relative' }}>
      {/* Sticky actor header - positioned over the diagram */}
      <svg 
        ref={headerSvgRef}
        width={diagram.width}
        height={100}
        className="sequence-diagram-header"
        style={{
          position: 'sticky',
          top: '20px',
          zIndex: 10,
          pointerEvents: 'none',
          backgroundColor: 'white',
          paddingLeft: '20px',
          paddingTop: '20px'
        }}
      />
      
      {/* Main diagram - positioned at top */}
      <svg 
        ref={svgRef}
        width={diagram.width}
        height={diagram.height}
        className="sequence-diagram"
        style={{ marginTop: '-100px' }}
      />
    </div>
  );
}

function renderStickyActors(svg, diagram) {
  svg.innerHTML = '';
  
  // Add the same defs as main diagram for consistent styling
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  
  // Only render top actor elements
  diagram.elements.forEach(element => {
    if (element.y < 100 && (element.type === 'rect' || element.type === 'text' || element.type === 'actor-image')) {
      let el;
      if (element.type === 'rect') el = createRect(element);
      else if (element.type === 'text') el = createText(element);
      else if (element.type === 'actor-image') el = createActorImage(element);
      
      if (el) svg.appendChild(el);
    }
  });
}

function renderSVG(svg, diagram, onElementClick) {
  svg.innerHTML = '';

  // Add defs for markers
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  
  // Regular arrows
  const marker = createMarker('arrow-default', 'arrow-marker', false);
  defs.appendChild(marker);
  const openMarker = createMarker('arrow-open-default', 'arrow-marker-open', true);
  defs.appendChild(openMarker);
  
  // Green arrows for funds flow
  const markerFunds = createMarker('arrow-funds', 'arrow-marker-funds', false, '#00a651');
  defs.appendChild(markerFunds);
  const openMarkerFunds = createMarker('arrow-open-funds', 'arrow-marker-open-funds', true, '#00a651');
  defs.appendChild(openMarkerFunds);
  
  // Reversed arrow (for marker-start on bidirectional)
  const markerReversed = createMarkerReversed('arrow-reversed', 'arrow-marker', false);
  defs.appendChild(markerReversed);
  
  svg.appendChild(defs);

  // Render elements
  diagram.elements.forEach(element => {
    let g;
    switch (element.type) {
      case 'rect':
        g = createRect(element);
        break;
      case 'text':
        g = createText(element);
        break;
      case 'actor-image':
        g = createActorImage(element);
        break;
      case 'line':
        g = createLine(element);
        break;
      case 'arrow':
        g = createArrow(element);
        break;
      case 'self-arrow':
        g = createSelfArrow(element);
        break;
      case 'note':
        g = createNote(element);
        break;
      case 'divider':
        g = createDivider(element);
        break;
      case 'delay':
        g = createDelay(element);
        break;
      case 'section':
        g = createSection(element);
        break;
      case 'section-divider':
        g = createSectionDivider(element);
        break;
    }
    
    if (g) {
      // Add click handler to navigate to source
      if (element.sourceLineNum !== undefined && onElementClick) {
        g.style.cursor = 'pointer';
        g.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          onElementClick(element.sourceLineNum);
        });
      }
      svg.appendChild(g);
    }
  });
}

function createMarker(id, className, open, color = '#333') {
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '5');
  marker.setAttribute('orient', 'auto');
  marker.setAttribute('markerUnits', 'userSpaceOnUse');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  
  if (open) {
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
  } else {
    path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    path.setAttribute('fill', color);
  }
  
  path.setAttribute('class', className);

  marker.appendChild(path);
  return marker;
}

function createMarkerReversed(id, className, open) {
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '10');
  marker.setAttribute('refX', '1');
  marker.setAttribute('refY', '5');
  marker.setAttribute('orient', 'auto');
  marker.setAttribute('markerUnits', 'userSpaceOnUse');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  
  // Reversed arrow pointing left
  if (open) {
    path.setAttribute('d', 'M 10 0 L 0 5 L 10 10');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#333');
    path.setAttribute('stroke-width', '2');
  } else {
    path.setAttribute('d', 'M 10 0 L 0 5 L 10 10 z');
    path.setAttribute('fill', '#333');
  }
  
  path.setAttribute('class', className);

  marker.appendChild(path);
  return marker;
}

function createRect(element) {
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', element.x);
  rect.setAttribute('y', element.y);
  rect.setAttribute('width', element.width);
  rect.setAttribute('height', element.height);
  rect.setAttribute('class', element.className);
  rect.setAttribute('rx', '5');
  return rect;
}

function createText(element) {
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', element.x);
  text.setAttribute('y', element.y);
  text.setAttribute('class', element.className);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.innerHTML = element.text;
  return text;
}

function createActorImage(element) {
  const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  image.setAttribute('x', element.x);
  image.setAttribute('y', element.y);
  image.setAttribute('width', element.width);
  image.setAttribute('height', element.height);
  image.setAttribute('href', element.image);
  image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  return image;
}

function createLine(element) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', element.x1);
  line.setAttribute('y1', element.y1);
  line.setAttribute('x2', element.x2);
  line.setAttribute('y2', element.y2);
  line.setAttribute('class', element.className);
  return line;
}

function createArrow(element) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', element.x1);
  line.setAttribute('y1', element.y1);
  line.setAttribute('x2', element.x2);
  line.setAttribute('y2', element.y2);
  
  let className = 'message';
  if (element.dashed) className += ' dashed';
  if (element.bold) className += ' bold';
  if (element.funds) className += ' funds';
  line.setAttribute('class', className);

  // Add marker based on arrow type
  if (!element.lost && !element.bidirectional) {
    // Unidirectional: arrow points at destination (x2, y2)
    const markerId = element.open ? 'arrow-open' : 'arrow';
    const markerClass = element.funds ? 'funds' : 'default';
    line.setAttribute('marker-end', `url(#${markerId}-${markerClass})`);
  }

  g.appendChild(line);

  // Lost message (X)
  if (element.lost) {
    const size = 8;
    const x = element.x2;
    const y = element.y2;
    
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', x - size);
    line1.setAttribute('y1', y - size);
    line1.setAttribute('x2', x + size);
    line1.setAttribute('y2', y + size);
    line1.setAttribute('class', 'message');
    
    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', x - size);
    line2.setAttribute('y1', y + size);
    line2.setAttribute('x2', x + size);
    line2.setAttribute('y2', y - size);
    line2.setAttribute('class', 'message');
    
    g.appendChild(line1);
    g.appendChild(line2);
  }

  // Bidirectional arrows
  if (element.bidirectional) {
    // Arrows point away from each other (toward the ends of the line)
    line.setAttribute('marker-start', 'url(#arrow-reversed)');
    line.setAttribute('marker-end', 'url(#arrow-default)');
  }

  // Label
  const labelX = (element.x1 + element.x2) / 2;
  const arrowWidth = Math.abs(element.x2 - element.x1);
  const leftX = Math.min(element.x1, element.x2);
  const labelHeight = element.labelHeight || 18;
  
  // Use foreignObject to support HTML formatting
  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('x', leftX);
  foreignObject.setAttribute('y', element.y1 - labelHeight - 5);
  foreignObject.setAttribute('width', arrowWidth);
  foreignObject.setAttribute('height', labelHeight);
  foreignObject.setAttribute('overflow', 'visible');
  
  const div = document.createElement('div');
  div.className = 'message-label-content';
  div.innerHTML = element.label;
  foreignObject.appendChild(div);
  
  g.appendChild(foreignObject);
  
  // Add $ symbol at the start for funds flow
  if (element.funds) {
    const dollarText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    dollarText.setAttribute('x', element.x1 - 15);
    dollarText.setAttribute('y', element.y1);
    dollarText.setAttribute('class', 'funds-symbol');
    dollarText.setAttribute('text-anchor', 'end');
    dollarText.textContent = '$';
    g.appendChild(dollarText);
  }

  return g;
}

function createSelfArrow(element) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  // Create a loop path that goes out to the right and back
  const loopWidth = 40;
  const loopHeight = 30;
  const x = element.x;
  const y = element.y;
  
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  // Start at entity, go right, curve down, curve back left, return to entity
  const d = `M ${x} ${y} 
             L ${x + loopWidth} ${y} 
             Q ${x + loopWidth + 10} ${y} ${x + loopWidth + 10} ${y + loopHeight/2}
             Q ${x + loopWidth + 10} ${y + loopHeight} ${x + loopWidth} ${y + loopHeight}
             L ${x} ${y + loopHeight}`;
  path.setAttribute('d', d);
  
  let className = 'message';
  if (element.dashed) className += ' dashed';
  if (element.bold) className += ' bold';
  if (element.funds) className += ' funds';
  path.setAttribute('class', className);
  path.setAttribute('fill', 'none');
  
  // Add arrow at the end
  const markerId = element.open ? 'arrow-open' : 'arrow';
  const markerClass = element.funds ? 'funds' : 'default';
  path.setAttribute('marker-end', `url(#${markerId}-${markerClass})`);
  
  g.appendChild(path);
  
  // Label positioned to the right of the loop
  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('x', x + loopWidth + 20);
  foreignObject.setAttribute('y', y + loopHeight / 2 - 15);
  foreignObject.setAttribute('width', 300);
  foreignObject.setAttribute('height', 30);
  
  const div = document.createElement('div');
  div.className = 'message-label-content';
  div.innerHTML = element.label;
  foreignObject.appendChild(div);
  
  g.appendChild(foreignObject);
  
  // Add $ symbol at the start for funds flow
  if (element.funds) {
    const dollarText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    dollarText.setAttribute('x', x - 15);
    dollarText.setAttribute('y', y);
    dollarText.setAttribute('class', 'funds-symbol');
    dollarText.setAttribute('text-anchor', 'end');
    dollarText.textContent = '$';
    g.appendChild(dollarText);
  }

  return g;
}

function createNote(element) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  const noteType = element.noteType || 'default';
  const noteClass = noteType === 'default' ? 'note' : `note note-${noteType}`;
  
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', element.x);
  rect.setAttribute('y', element.y);
  rect.setAttribute('width', element.width);
  rect.setAttribute('height', element.height);
  rect.setAttribute('class', noteClass);
  rect.setAttribute('rx', '5');
  g.appendChild(rect);

  // Add icon for special note types
  if (noteType !== 'default') {
    const iconX = element.x + 10;
    const iconY = element.y + 10;
    
    if (noteType === 'info') {
      // Blue "i" icon
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', iconX + 10);
      circle.setAttribute('cy', iconY + 10);
      circle.setAttribute('r', '10');
      circle.setAttribute('fill', '#2196F3');
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', iconX + 10);
      text.setAttribute('y', iconY + 10);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', 'white');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-size', '14');
      text.textContent = 'i';
      g.appendChild(text);
    } else if (noteType === 'caution') {
      // Orange caution triangle
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M 10 2 L 18 18 L 2 18 Z');
      path.setAttribute('transform', `translate(${iconX}, ${iconY})`);
      path.setAttribute('fill', '#FF9800');
      path.setAttribute('stroke', 'white');
      path.setAttribute('stroke-width', '2');
      g.appendChild(path);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', iconX + 10);
      text.setAttribute('y', iconY + 14);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', 'white');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-size', '14');
      text.textContent = '!';
      g.appendChild(text);
    } else if (noteType === 'warning') {
      // Red stop sign
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', iconX + 10);
      circle.setAttribute('cy', iconY + 10);
      circle.setAttribute('r', '10');
      circle.setAttribute('fill', '#f44336');
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', iconX + 10);
      text.setAttribute('y', iconY + 10);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', 'white');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('font-size', '16');
      text.textContent = '×';
      g.appendChild(text);
    } else if (noteType === 'idea') {
      // Green lightbulb icon - improved design
      const bulb = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      bulb.setAttribute('transform', `translate(${iconX}, ${iconY})`);
      
      // Light rays emanating from bulb
      const rays = [
        { x1: 10, y1: 2, x2: 10, y2: -2 },      // top
        { x1: 15, y1: 4, x2: 19, y2: 2 },       // top-right
        { x1: 17, y1: 8, x2: 21, y2: 8 },       // right
        { x1: 5, y1: 4, x2: 1, y2: 2 },         // top-left
        { x1: 3, y1: 8, x2: -1, y2: 8 }         // left
      ];
      
      rays.forEach(ray => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', ray.x1);
        line.setAttribute('y1', ray.y1);
        line.setAttribute('x2', ray.x2);
        line.setAttribute('y2', ray.y2);
        line.setAttribute('stroke', '#FFD700');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-linecap', 'round');
        bulb.appendChild(line);
      });
      
      // Bulb outline (pear shape)
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M 10 2 C 6 2 4 4 4 7 C 4 9 5 10 6 11 L 6 14 L 14 14 L 14 11 C 15 10 16 9 16 7 C 16 4 14 2 10 2 Z');
      path.setAttribute('fill', '#FFD700');
      path.setAttribute('stroke', '#00A651');
      path.setAttribute('stroke-width', '1.5');
      bulb.appendChild(path);
      
      // Base threads
      const thread1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      thread1.setAttribute('x1', '6');
      thread1.setAttribute('y1', '14');
      thread1.setAttribute('x2', '14');
      thread1.setAttribute('y2', '14');
      thread1.setAttribute('stroke', '#00A651');
      thread1.setAttribute('stroke-width', '1.5');
      bulb.appendChild(thread1);
      
      const thread2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      thread2.setAttribute('x1', '6');
      thread2.setAttribute('y1', '16');
      thread2.setAttribute('x2', '14');
      thread2.setAttribute('y2', '16');
      thread2.setAttribute('stroke', '#00A651');
      thread2.setAttribute('stroke-width', '1.5');
      bulb.appendChild(thread2);
      
      // Base cap
      const cap = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      cap.setAttribute('x', '7');
      cap.setAttribute('y', '17');
      cap.setAttribute('width', '6');
      cap.setAttribute('height', '2');
      cap.setAttribute('fill', '#00A651');
      cap.setAttribute('rx', '1');
      bulb.appendChild(cap);
      
      // Shine effect
      const shine = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      shine.setAttribute('cx', '8');
      shine.setAttribute('cy', '5');
      shine.setAttribute('r', '1.5');
      shine.setAttribute('fill', 'white');
      shine.setAttribute('opacity', '0.8');
      bulb.appendChild(shine);
      
      g.appendChild(bulb);
    }
  }

  const leftPadding = noteType !== 'default' ? 40 : 10;
  const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  foreignObject.setAttribute('x', element.x + leftPadding);
  foreignObject.setAttribute('y', element.y + 10);
  foreignObject.setAttribute('width', element.width - leftPadding - 10);
  foreignObject.setAttribute('height', element.height - 20);
  
  const div = document.createElement('div');
  div.className = 'note-content';
  div.innerHTML = processMarkdown(element.text);
  foreignObject.appendChild(div);
  
  g.appendChild(foreignObject);

  return g;
}

function createDivider(element) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', element.x);
  line.setAttribute('y1', element.y);
  line.setAttribute('x2', element.x + element.width);
  line.setAttribute('y2', element.y);
  line.setAttribute('class', `divider ${element.style}`);
  g.appendChild(line);

  if (element.label) {
    // Use foreignObject to support HTML content in SVG
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('x', element.x);
    foreignObject.setAttribute('y', element.y - 25);
    foreignObject.setAttribute('width', element.width);
    foreignObject.setAttribute('height', 30);
    
    const div = document.createElement('div');
    div.className = 'divider-label-content';
    div.innerHTML = element.label;
    foreignObject.appendChild(div);
    
    g.appendChild(foreignObject);
  }

  return g;
}

function createDelay(element) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  // Background lightbox
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', element.x);
  rect.setAttribute('y', element.y);
  rect.setAttribute('width', element.width);
  rect.setAttribute('height', element.height);
  rect.setAttribute('class', 'delay-box');
  rect.setAttribute('rx', '5');
  g.appendChild(rect);
  
  // Spinner icon (using circular dots)
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2 - 10;
  const spinnerRadius = 12;
  
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const cx = centerX + Math.cos(angle) * spinnerRadius;
    const cy = centerY + Math.sin(angle) * spinnerRadius;
    
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', '2');
    circle.setAttribute('class', 'delay-spinner');
    circle.setAttribute('opacity', 0.2 + (i * 0.1));
    g.appendChild(circle);
  }
  
  // Label text
  if (element.label) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', centerX);
    text.setAttribute('y', centerY + 30);
    text.setAttribute('class', 'delay-label');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = element.label;
    g.appendChild(text);
  }

  return g;
}

function createSection(element) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', element.x);
  rect.setAttribute('y', element.y);
  rect.setAttribute('width', element.width);
  rect.setAttribute('height', element.height);
  rect.setAttribute('class', 'section');
  rect.setAttribute('rx', '5');
  g.appendChild(rect);

  if (element.label) {
    // Calculate label width dynamically based on content, with a max
    const maxLabelWidth = element.width - 20;
    const estimatedWidth = Math.min(element.label.length * 8 + 20, maxLabelWidth);
    
    const labelRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    labelRect.setAttribute('x', element.x);
    labelRect.setAttribute('y', element.y);
    labelRect.setAttribute('width', estimatedWidth);
    labelRect.setAttribute('height', 20);
    labelRect.setAttribute('class', 'section-label-bg');
    g.appendChild(labelRect);

    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('x', element.x + 5);
    foreignObject.setAttribute('y', element.y);
    foreignObject.setAttribute('width', estimatedWidth - 10);
    foreignObject.setAttribute('height', 20);
    
    const div = document.createElement('div');
    div.className = 'section-label-content';
    div.innerHTML = element.label;
    foreignObject.appendChild(div);
    
    g.appendChild(foreignObject);
  }

  return g;
}

function createSectionDivider(element) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', element.x);
  line.setAttribute('y1', element.y);
  line.setAttribute('x2', element.x + element.width);
  line.setAttribute('y2', element.y);
  line.setAttribute('class', 'section-divider');
  line.setAttribute('stroke-dasharray', '5,5');
  g.appendChild(line);

  if (element.label) {
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('x', element.x + 5);
    foreignObject.setAttribute('y', element.y - 20);
    foreignObject.setAttribute('width', 200);
    foreignObject.setAttribute('height', 25);
    
    const div = document.createElement('div');
    div.className = 'section-label-content';
    div.innerHTML = element.label;
    foreignObject.appendChild(div);
    
    g.appendChild(foreignObject);
  }

  return g;
}

function processMarkdown(text) {
  if (!text) return '';
  
  text = text.replace(/\{(fa[bslrd])-([^}]+)\}/g, '<i class="$1 fa-$2"></i>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  return text;
}
