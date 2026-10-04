const select=document.getElementById('theme-select');
const articles=document.querySelectorAll('[data-categories]');
const status=document.getElementById('filter-status');
select.addEventListener('change',()=>{let count=0;for(const article of articles){const visible=select.value==='all'||article.dataset.categories.split(' ').includes(select.value);article.hidden=!visible;if(visible)count++;}status.textContent=`${select.selectedOptions[0].textContent}：${count}本の記事を表示しています。`;});

const chart=document.querySelector('.publication-chart');
if(chart){
  const plot=chart.querySelector('.publication-plot');
  const points=[...chart.querySelectorAll('[data-publication-point]')];
  const tooltip=chart.querySelector('.publication-tooltip');
  const meta=tooltip.querySelector('.publication-tooltip-meta');
  const title=tooltip.querySelector('.publication-tooltip-title');
  let active=null;
  let pinned=false;
  let keyboard=false;
  function positionTooltip(){
    if(!active)return;
    const bounds=chart.getBoundingClientRect();
    const point=active.getBoundingClientRect();
    const centerX=point.left+point.width/2-bounds.left;
    const centerY=point.top+point.height/2-bounds.top;
    const width=tooltip.offsetWidth;
    const height=tooltip.offsetHeight;
    tooltip.style.left=`${Math.max(8,Math.min(centerX-width/2,bounds.width-width-8))}px`;
    tooltip.style.top=`${Math.max(0,centerY-height-15)}px`;
  }
  function show(point){
    if(!point)return;
    if(active!==point){
      active?.classList.remove('is-active');
      active?.setAttribute('aria-describedby','publication-chart-help');
      active=point;
      active.classList.add('is-active');
      active.setAttribute('aria-describedby','publication-tooltip');
      meta.textContent=`${point.dataset.date.replaceAll('-','.')} · ${point.dataset.ordinal}本目 · ${point.dataset.genre}`;
      title.textContent=point.dataset.title;
    }
    tooltip.hidden=false;
    positionTooltip();
  }
  function hide(){
    active?.classList.remove('is-active');
    active?.setAttribute('aria-describedby','publication-chart-help');
    active=null;
    pinned=false;
    keyboard=false;
    tooltip.hidden=true;
  }
  // Resolve by nearest centre so densely spaced dates do not mask earlier points.
  function nearest(event){
    let result=null;
    let distance=24;
    for(const point of points){
      const box=point.getBoundingClientRect();
      const delta=Math.hypot(event.clientX-box.left-box.width/2,event.clientY-box.top-box.height/2);
      if(delta<distance){distance=delta;result=point;}
    }
    return result;
  }
  plot.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch'||pinned||keyboard)return;
    const point=nearest(event);
    if(point)show(point);else hide();
  });
  chart.addEventListener('pointerleave',()=>{if(!pinned&&!keyboard)hide();});
  plot.addEventListener('click',event=>{
    const point=event.detail===0?event.target.closest('[data-publication-point]'):nearest(event);
    if(!point){hide();return;}
    if(pinned&&active===point){hide();return;}
    pinned=true;
    keyboard=event.detail===0;
    show(point);
  });
  // Pointer focus is handled by the nearest-point logic; keyboard focus has its own mode.
  plot.addEventListener('pointerdown',()=>{keyboard=false;});
  plot.addEventListener('focusin',event=>{
    const point=event.target.closest('[data-publication-point]');
    if(point&&point.matches(':focus-visible')){keyboard=true;show(point);}
  });
  plot.addEventListener('focusout',event=>{if(!plot.contains(event.relatedTarget)&&keyboard)hide();});
  plot.addEventListener('keydown',event=>{
    const point=event.target.closest('[data-publication-point]');
    if(!point)return;
    const index=points.indexOf(point);
    const keys={ArrowRight:Math.min(index+1,points.length-1),ArrowUp:Math.min(index+1,points.length-1),ArrowLeft:Math.max(index-1,0),ArrowDown:Math.max(index-1,0),Home:0,End:points.length-1};
    if(!(event.key in keys))return;
    event.preventDefault();
    const next=points[keys[event.key]];
    points.forEach(item=>{item.tabIndex=item===next?0:-1;});
    keyboard=true;
    pinned=false;
    next.focus();
    show(next);
  });
  document.addEventListener('pointerdown',event=>{if(!chart.contains(event.target))hide();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  window.addEventListener('resize',positionTooltip);
}
