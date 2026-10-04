const select=document.getElementById('theme-select');
const articles=document.querySelectorAll('[data-theme]');
const status=document.getElementById('filter-status');
select.addEventListener('change',()=>{let count=0;for(const article of articles){const visible=select.value==='all'||article.dataset.theme===select.value;article.hidden=!visible;if(visible)count++;}status.textContent=`${select.selectedOptions[0].textContent}：${count}本の記事を表示しています。`;});
