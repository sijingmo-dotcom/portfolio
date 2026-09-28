'use strict';
let hostedMode=false,canEditHere=true;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let categories=['全部作品','动漫制作','产品TVC','电商详情页','IP形象设计','视觉海报'];
let content,draft,dirty=false,editTab='profile',editorWorkCategory='动漫制作',filter='全部作品',workPosition=null,detailOpener=null,uploadCount=0,filePickerActive=false;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s,location.origin);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
const imageTag=(src,alt,cls='')=>`<img src="${escape(safeUrl(src))}" alt="${escape(alt)}" class="${cls}" loading="lazy">`;
const displayTitle=w=>w.demo?w.title.replace(/作品 \d+$/,'作品'):w.title;
const clone=o=>JSON.parse(JSON.stringify(o));
function remember(){try{sessionStorage.setItem('folio-view',JSON.stringify({filter,workPosition,section:$('#studio').hidden?'hero':'studio',y:window.scrollY}))}catch{}}
function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').hidden=true,3500)}
function text(id,value){$(id).textContent=value||''}
function categoryList(data){return [...new Set([...(data.categories||['动漫制作','产品TVC','电商详情页','IP形象设计','视觉海报']),...data.works.map(w=>w.category)].filter(Boolean))]}
function applyAppearance(a={}){
 document.documentElement.dataset.theme=a.theme||'sky';
 const saturation=Math.max(0,Math.min(100,Number(a.saturation??65)));
 document.documentElement.style.setProperty('--saturation',saturation+'%');
}

const copyFields=[
 ['navAbout','导航：个人介绍','[data-hero-section="about"],[data-section="about"]','个人介绍'],
 ['navStrengths','导航：个人优势','[data-hero-section="strengths"],[data-section="strengths"]','个人优势'],
 ['navWorks','导航：精选作品','[data-hero-section="works"],[data-section="works"]','精选作品'],
 ['aboutTag','介绍英文标题','#about .section-heading .eyebrow','ABOUT ME'],
 ['aboutTitle','介绍主标题','#about h2','设计是我与\n世界的对话。'],
 ['hello','姓名上方引言','.bio>.eyebrow',"HELLO, I'M"],
 ['skills','技能区标题','.skills>.eyebrow','MY TOOLKIT / 技能'],
 ['strengthTag','优势英文标题','#strengths .section-heading .eyebrow','MY APPROACH'],
 ['strengthTitle','优势主标题','#strengths h2','好的创意，\n也需要好的实现。'],
 ['worksTag','作品英文标题','#works .section-heading .eyebrow','SELECTED WORK'],
 ['worksTitle','作品主标题','#works h2','精选作品'],
 ['footerTitle','页尾标语','.footer-mark','Make it\nmean something.'],
 ['footerCaption','页尾说明','footer>div>p','视觉 · 动态 · 想象'],

 ['collapse','收起按钮','.section-nav [data-home]','收起 ×'],
 ['edit','首页编辑按钮','#editToggle','编辑作品集 ↗'],
 ['editShort','内容页编辑按钮','#editFromNav','编辑'],
 ['back','作品返回按钮','#backWork','← 返回作品'],
 ['backBottom','作品底部返回按钮','#backBottom','← 回到刚才的位置'],
 ['empty','分类为空时提示','#emptyWorks','这个分类还没有作品，点击「编辑作品集」添加。'],
 ['all','全部作品按钮','','全部作品'],['placeholder','作品占位说明','','待添加作品'],
 ['portrait','默认头像文字','','You.'],['portraitHelp','默认头像说明','','在编辑器中上传头像'],
 ['contactEmpty','联系方式为空时提示','','联系方式待填写'],
 ['emailLabel','邮箱前缀','','邮箱'],['phoneLabel','电话前缀','','电话'],['wechatLabel','微信前缀','','微信'],
 ['mediaEmpty','作品内容为空时提示','','尚未上传作品内容。请在编辑页添加视频或图片。'],
 ['pageTitle','浏览器标题（留空自动使用姓名）','','']
];
const copyValue=(key)=>content.copy?.[key]??copyFields.find(f=>f[0]===key)?.[3]??'';
function renderCopy(){for(const [key,,selector] of copyFields)if(selector)$$(selector).forEach(el=>{el.textContent=copyValue(key);el.style.whiteSpace='pre-line'});if(copyValue('pageTitle'))document.title=copyValue('pageTitle')}

const typeGroups=[
 ['navigation','导航级 · 个人介绍 / 个人优势 / 精选作品','[data-hero-section],[data-section],[data-section] span',14,['navAbout','navStrengths','navWorks']],
 ['eyebrow','栏目标签级 · ABOUT ME / MY APPROACH / SELECTED WORK','.section-heading .eyebrow',12,['aboutTag','strengthTag','worksTag']],
 ['headline','主标题级 · 三个区块主标题 / 页尾标语','.section-heading h2,.footer-mark,.footer-mark i',42,['aboutTitle','strengthTitle','worksTitle','footerTitle']],
 ['contentTitle','内容标题级 · 姓名 / 优势标题 / 作品名称','#name,.strength-card h3,.work-info h3,.portrait-placeholder',22,['name','strengthName','workName']],
 ['bodyText','正文级 · 介绍 / 优势说明 / 作品说明 / 联系方式','#bio,#role,#contacts,#contacts a,#contacts div,.strength-card p:last-child,.work-description,.media-empty',16,['bio','strengthBody','workBody','contacts','role']],
 ['support','辅助级 · 技能 / 英文副标题 / 分类 / 按钮 / 提示','.bio>.eyebrow,.skills>.eyebrow,.skill-label,.skill-label span,.strength-card .eyebrow,.work-subtitle,#filters button,.placeholder-cover span,.portrait-label,#emptyWorks,#detailCategory,#footerName,footer>div>p,footer button,#backWork,#backBottom,#editToggle,#editFromNav,.section-nav [data-home]',13,['skills','skillName','workSubtitle','filters','detailTitle']]
];
let activeTypeGroup='navigation';
function normalizeTypography(settings={}){const next={};for(const [key,,,,legacy] of typeGroups){next[key]=settings[key]||{...(settings.global||{}),...(legacy.map(k=>settings[k]).find(Boolean)||{})}}return next}
function applyTypography(settings={}){
 settings=normalizeTypography(settings);
 let style=$('#typographyOverrides');if(!style){style=document.createElement('style');style.id='typographyOverrides';document.head.append(style)}
 style.textContent=typeGroups.map(([key,,selector,size])=>{const value=settings[key]||{};const fontSize=Number.isFinite(value.size)?Math.max(10,Math.min(120,value.size))+'px':key==='headline'?'clamp(30px,3.4vw,42px)':size+'px';let rules='font-size:'+fontSize+'!important;';if(/^#[0-9a-f]{6}$/i.test(value.color||''))rules+='color:'+value.color+'!important;background-image:none!important;-webkit-text-fill-color:'+value.color+'!important;';return ':is(#studio,#detail,.topbar,#hero) :is('+selector+'){'+rules+'}'}).join('\n');
}
function typeControls(){
 const value=draft.typography?.[activeTypeGroup]||{};
 return '<h3>文字颜色与字号</h3><p class="help">文字分为六个级别。同一级别统一调整颜色与字号，主标题默认随屏幕大小适配。留空字号或恢复默认即可使用分级默认值。</p><label class="field">调整对象<select id="typeGroup">'+typeGroups.map(([key,label])=>'<option value="'+key+'" '+(key===activeTypeGroup?'selected':'')+'>'+escape(label)+'</option>').join('')+'</select></label><div class="type-tools"><label class="field">文字颜色<input type="color" id="typeColor" value="'+(value.color||'#35454d')+'"></label><button type="button" class="small-button" data-eyedropper>◉ 吸取颜色</button><label class="field">字号（px）<input type="number" id="typeSize" min="10" max="120" value="'+(value.size??'')+'" placeholder="自动"></label><button type="button" class="small-button" data-type-reset>恢复此项默认</button></div><p class="type-sample" style="'+(value.color?'color:'+value.color+';':'')+(value.size?'font-size:'+value.size+'px;':'')+'">字体预览 · Design &amp; Motion</p>';
}
function setTypography(property,value){draft.typography??={};draft.typography[activeTypeGroup]??={};if(value===null)delete draft.typography[activeTypeGroup][property];else draft.typography[activeTypeGroup][property]=value;applyTypography(draft.typography);const sample=$('.type-sample');if(sample){sample.style.color=draft.typography[activeTypeGroup].color||'';sample.style.fontSize=draft.typography[activeTypeGroup].size?draft.typography[activeTypeGroup].size+'px':''}markDirty()}
$('#editForm').addEventListener('input',e=>{if(e.target.id==='typeColor')setTypography('color',e.target.value);if(e.target.id==='typeSize'){const n=Number(e.target.value);if(!e.target.value)setTypography('size',null);else if(Number.isFinite(n)&&n>=10&&n<=120)setTypography('size',n)}});
$('#editForm').addEventListener('change',e=>{if(e.target.id==='typeGroup'){activeTypeGroup=e.target.value;renderEditor()}});
$('#editForm').addEventListener('click',async e=>{
 if(e.target.closest('[data-type-reset]')){if(draft.typography)delete draft.typography[activeTypeGroup];applyTypography(draft.typography);markDirty();renderEditor()}
 if(!e.target.closest('[data-eyedropper]'))return;
 if(uploadCount){notify('文件正在上传，请稍候');return}
 const editorScroll=$('#editForm').scrollTop;
 closeEditor(true);
 const restoreEditor=()=>{openEditor();$('#editForm').scrollTop=editorScroll};
 if(!window.EyeDropper){
  let bar=$('#colorPreviewBar');if(bar)bar.remove();
  bar=document.createElement('div');bar.id='colorPreviewBar';bar.innerHTML='<span>预览选色（当前浏览器不支持屏幕吸色）</span><input type="color" aria-label="预览文字颜色"><button type="button">完成，返回编辑</button>';
  document.body.append(bar);const picker=bar.querySelector('input');picker.value=draft.typography?.[activeTypeGroup]?.color||'#35454d';picker.oninput=()=>setTypography('color',picker.value);bar.querySelector('button').onclick=()=>{bar.remove();restoreEditor()};picker.click();return;
 }
 try{const result=await new EyeDropper().open();setTypography('color',result.sRGBHex)}catch(error){if(error.name!=='AbortError')notify('吸色未完成，请重试')}finally{restoreEditor()}
});

let loadedFontUrl='',fontRequest=0;
async function applyFont(font){
 const url=font?.url||'';if(url===loadedFontUrl)return;loadedFontUrl=url;const request=++fontRequest;
 if(!url){document.documentElement.style.removeProperty('--custom-font');return}
 try{if(!/^\/assets\/[a-zA-Z0-9_.-]+\.(woff2?|ttf|otf)$/.test(url))throw new Error('字体地址无效');const face=new FontFace('PortfolioFont'+request,'url('+JSON.stringify(url)+')');await face.load();if(request!==fontRequest)return;document.fonts.add(face);document.documentElement.style.setProperty('--custom-font',face.family)}catch{if(request===fontRequest){loadedFontUrl='';document.documentElement.style.removeProperty('--custom-font');notify('字体无法加载，已使用默认字体')}}
}

function render(){
 content.typography=normalizeTypography(content.typography);
 categories=['全部作品',...categoryList(content)];
 if(!categories.includes(filter))filter='全部作品';
 applyAppearance(content.appearance);
 document.documentElement.dataset.theme=content.appearance?.theme||'sky';
 const p=content.profile;text('#name',p.name);text('#role',p.role);text('#bio',p.bio);text('#footerName',p.name);document.title=`${p.name} · 个人视觉作品集`;
 $('#portrait').innerHTML=p.avatar?imageTag(p.avatar,p.name+'的头像'):'<span class="portrait-placeholder">'+escape(copyValue("portrait"))+'</span><span class="portrait-label">'+escape(copyValue("portraitHelp"))+'</span>';
 const contacts=[];if(p.email)contacts.push(`<a href="mailto:${escape(p.email)}">${escape(copyValue("emailLabel"))} · ${escape(p.email)}</a>`);if(p.phone)contacts.push(`<a href="tel:${escape(p.phone.replace(/[^\d+ -]/g,''))}">${escape(copyValue("phoneLabel"))} · ${escape(p.phone)}</a>`);if(p.wechat)contacts.push(`<div>${escape(copyValue("wechatLabel"))} · ${escape(p.wechat)}</div>`);$('#contacts').innerHTML=contacts.join('')||'<div class="contact-empty">'+escape(copyValue("contactEmpty"))+'</div>';
 $('#skillList').innerHTML=p.skills.map(s=>{const v=Math.min(100,Math.max(0,Number(s.value)||0));return `<div class="skill"><div class="skill-label"><span>${escape(s.name)}</span><span>${v}%</span></div><div class="skill-track" role="meter" aria-label="${escape(s.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}"><span style="width:${v}%"></span></div></div>`}).join('');
 $('#strengthList').innerHTML=content.strengths.map((s,i)=>`<article class="strength-card"><h3>${escape(s.title)}</h3><p class="eyebrow">${escape(s.en)}</p><p>${escape(s.text)}</p></article>`).join('');
 renderWorks();renderCopy();applyFont(content.font);applyTypography(content.typography);
}
function renderWorks(){
 $('#filters').innerHTML=categories.map(c=>`<button data-filter="${escape(c)}" class="${c===filter?'active':''}" aria-pressed="${c===filter}">${escape(c==='全部作品'?copyValue('all'):c)}</button>`).join('');
 const works=content.works.filter(w=>filter==='全部作品'||w.category===filter);
 const workCard=w=>`<button class="work-card" data-work="${escape(w.id)}" aria-label="查看作品：${escape(w.title)}"><div class="work-cover">${w.cover?imageTag(w.cover,w.title):`<div class="placeholder-cover"><span>${escape(w.category)} · ${escape(copyValue("placeholder"))}</span></div>`}</div><div class="work-info"><h3>${escape(displayTitle(w))}</h3></div>${w.subtitle?`<p class="work-subtitle">${escape(w.subtitle)}</p>`:''}${w.description?`<p class="work-description">${escape(w.description)}</p>`:''}</button>`;
 $('#workGrid').classList.toggle('grouped',filter==='全部作品');
 $('#workGrid').innerHTML=filter==='全部作品'?categoryList(content).map(c=>{const items=works.filter(w=>w.category===c);return `<section class="work-category"><h3 class="category-heading">${escape(c)}</h3><div class="work-grid">${items.map(workCard).join('')}</div>${items.length?'':'<p class="empty">'+escape(copyValue('empty'))+'</p>'}</section>`}).join(''):works.map(workCard).join('');
 $('#emptyWorks').hidden=!!works.length;
}
function reveal(section='about',restore=false){$('#studio').hidden=false;requestAnimationFrame(()=>{if(restore&&workPosition&&section==='works')window.scrollTo({top:workPosition.y,behavior:'instant'});else $('#'+section).scrollIntoView({behavior:'smooth'});remember()})}
$('#hero').setAttribute('tabindex','0');
$('#hero').setAttribute('role','button');
$('#hero').setAttribute('aria-label','点击进入作品集');
$('#hero').addEventListener('click',e=>{if(e.target.closest('button,a,input'))return;reveal()});
$('#hero').addEventListener('keydown',e=>{if(e.target!==e.currentTarget)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();reveal()}});




function home(){remember();$('#studio').hidden=true;window.scrollTo({top:0,behavior:'smooth'});history.replaceState(null,'',location.pathname);remember()}

let detailZoom=50;
try{const raw=localStorage.getItem('folio-detail-zoom');const saved=Number(raw);if(raw!==null&&Number.isFinite(saved)&&saved>=0&&saved<=250)detailZoom=Math.max(25,saved)}catch{}
const zoomBar=document.createElement('div');zoomBar.className='detail-zoom';zoomBar.innerHTML='<button type="button" data-zoom-step="-25" aria-label="缩小图片">−</button><output id="zoomValue">100%</output><button type="button" data-zoom-step="25" aria-label="放大图片">＋</button><button type="button" data-zoom-reset>适合宽度</button>';
$('#detail .detail-top').after(zoomBar);
function resetDetailZoom(){ $('#detailMedia').style.width='100%';$('#detailMedia').style.setProperty('--image-zoom',detailZoom+'%');if($('#zoomValue'))$('#zoomValue').textContent=detailZoom+'%';$('#detail .detail-content').scrollLeft=0 }
zoomBar.querySelector('[data-zoom-reset]').textContent='恢复 50%';
zoomBar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;detailZoom=b.hasAttribute('data-zoom-reset')?50:Math.max(25,Math.min(250,detailZoom+Number(b.dataset.zoomStep)));resetDetailZoom();try{localStorage.setItem('folio-detail-zoom',String(detailZoom))}catch{}});

let currentWorkId=null;
const detailNav=document.createElement('nav');detailNav.className='detail-work-nav';detailNav.setAttribute('aria-label','切换作品');detailNav.innerHTML='<button type="button" data-work-prev aria-label="上一个作品">← <span>上一个作品</span></button><button type="button" data-work-next aria-label="下一个作品"><span>下一个作品</span> →</button>';$('#detail').append(detailNav);
function detailSequence(){return filter==='全部作品'?categoryList(content).flatMap(c=>content.works.filter(w=>w.category===c)):content.works.filter(w=>w.category===filter)}
function updateDetailNav(){const works=detailSequence(),i=works.findIndex(w=>w.id===currentWorkId);detailNav.querySelector('[data-work-prev]').disabled=i<=0;detailNav.querySelector('[data-work-next]').disabled=i<0||i>=works.length-1}
detailNav.onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;const works=detailSequence(),i=works.findIndex(w=>w.id===currentWorkId),next=works[i+(b.hasAttribute('data-work-prev')?-1:1)];if(next)openWork(next.id)};
function openWork(id){
 const w=content.works.find(w=>w.id===id);if(!w)return;
 const switching=$('#detail').open;if(!switching){workPosition={y:window.scrollY,filter,id};remember();detailOpener=document.activeElement;}$$('#detail video').forEach(v=>v.pause());currentWorkId=id;updateDetailNav();
 $('#detail').classList.toggle('seamless',w.category==='电商详情页');resetDetailZoom();
 text('#detailCategory',`${w.title} · ${w.category}`);$('#detail').setAttribute('aria-label',w.title);
 const videos=w.media.filter(m=>m.type==='video'),images=w.media.filter(m=>m.type!=='video');
 const media=videos.length?[...videos,...images]:images.length?images:w.cover?[{url:w.cover,type:'image'}]:[];
 $('#detailMedia').innerHTML=media.length?media.map((m,i)=>m.type==='video'?`<video controls playsinline ${i===0?'autoplay':''} preload="metadata" aria-label="${escape(w.title)} 视频 ${i+1}" src="${escape(safeUrl(m.url))}"></video>`:imageTag(m.url,w.title)).join(''):'<div class="media-empty">'+escape(copyValue("mediaEmpty"))+'</div>';
 history[switching?'replaceState':'pushState']({work:id},'',`#work-${encodeURIComponent(id)}`);if(!switching)$('#detail').showModal();$('#detail').scrollTop=0;document.body.style.overflow='hidden';
 const firstVideo=$('#detailMedia video');if(firstVideo)firstVideo.play().catch(()=>{});
}
function closeWork(fromHistory=false){
 if(!$('#detail').open)return;resetDetailZoom();$$('#detail video').forEach(v=>v.pause());$('#detail').close();document.body.style.overflow='';
 if(!fromHistory&&history.state?.work)history.back();
 if(workPosition){window.scrollTo({top:workPosition.y,behavior:'instant'});detailOpener?.focus({preventScroll:true})}
}
window.addEventListener('popstate',()=>{if($('#detail').open&&!history.state?.work)closeWork(true)});
$$('[data-home]').forEach(b=>b.onclick=home);
$$('[data-hero-section]').forEach(b=>b.onclick=()=>{const section=b.dataset.heroSection;reveal(section)});
$('#replayIntro').onclick=()=>{$$('.hero-camera,.hero-art,.hero-content,.topbar,.hero-bottom,.hero-index,.replay-intro').forEach(el=>{el.style.animation='none';void el.offsetHeight;el.style.animation=''})};
$('#hero').addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const r=e.currentTarget.getBoundingClientRect();$('.hero-art').style.setProperty('--scene-x',`${(e.clientX-r.left-r.width/2)*-.012}px`);$('.hero-art').style.setProperty('--scene-y',`${(e.clientY-r.top-r.height/2)*-.008}px`)});
$('#hero').addEventListener('pointerleave',()=>{$('.hero-art').style.setProperty('--scene-x','0px');$('.hero-art').style.setProperty('--scene-y','0px')});
const eyeAsset=new Image();let eyesReady=false;eyeAsset.onload=()=>{eyesReady=true};eyeAsset.src='/assets/hero-daylight-gold-eyes.png';
$('#hero').addEventListener('pointermove',e=>{
 const hero=$('#hero'),art=$('.hero-art');if(e.pointerType!=='mouse'||!eyesReady)return;
 const rect=art.getBoundingClientRect(),width=art.clientWidth,height=art.clientHeight,mobile=matchMedia('(max-width:680px)').matches;
 const scale=Math.min(width/eyeAsset.naturalWidth,height/eyeAsset.naturalHeight);
 const iw=eyeAsset.naturalWidth*scale,ih=eyeAsset.naturalHeight*scale,ox=(width-iw)*.5,oy=(height-ih)*.5;
 art.style.setProperty('--eyes-x',`${ox+iw*.50}px`);art.style.setProperty('--eyes-y',`${oy+ih*.334}px`);art.style.setProperty('--eyes-rx',`${iw*.19}px`);art.style.setProperty('--eyes-ry',`${ih*.085}px`);
 const x=((e.clientX-rect.left)*width/rect.width-ox)/iw,y=((e.clientY-rect.top)*height/rect.height-oy)/ih;
 const overPerson=((x-.50)/.29)**2+((y-.52)/.49)**2<1;
 hero.classList.toggle('eyes-awake',overPerson&&!e.target.closest('.hero-content,.replay-intro'));
});
$('#hero').addEventListener('pointerleave',()=>$('#hero').classList.remove('eyes-awake'));
$$('[data-section]').forEach(b=>b.onclick=()=>{const section=b.dataset.section;reveal(section)});
$('#filters').onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;renderWorks();workPosition={filter,y:window.scrollY};remember()};
$('#workGrid').onclick=e=>{const b=e.target.closest('[data-work]');if(b)openWork(b.dataset.work)};
$('#backWork').onclick=$('#closeDetail').onclick=$('#backBottom').onclick=()=>closeWork();
$('#detail').addEventListener('cancel',e=>{e.preventDefault();closeWork()});
let scrollTimer;window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{if(!$('#studio').hidden&&!$('#detail').open){if($('#works').getBoundingClientRect().top<window.innerHeight*.6){workPosition={filter,y:window.scrollY};}remember()}},120)},{passive:true});
new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)$$('[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===e.target.id))},{rootMargin:'-15% 0px -65% 0px'}).observe($('#about'));
const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)$$('[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===e.target.id))},{rootMargin:'-15% 0px -60% 0px'});['strengths','works'].forEach(id=>observer.observe($('#'+id)));
function field(label,key,value,kind='text',extra=''){return `<label class="field">${label}${kind==='textarea'?`<textarea data-key="${key}" ${extra}>${escape(value)}</textarea>`:`<input type="${kind}" data-key="${key}" value="${escape(value)}" ${extra}>`}</label>`}
function uploader(label,target,accept='image/png,image/jpeg,image/webp,image/gif',multiple=false){return `<label class="field">${label}<input type="file" data-upload="${target}" accept="${accept}" ${multiple?'multiple':''}></label>`}
function previousWorkIndex(works,index){
 if(!works[index])return -1;
 for(let i=index-1;i>=0;i--)if(works[i].category===works[index].category)return i;
 return -1;
}
function nextWorkIndex(works,index){
 if(!works[index])return -1;
 for(let i=index+1;i<works.length;i++)if(works[i].category===works[index].category)return i;
 return -1;
}
function renderEditor(){
 draft.typography=normalizeTypography(draft.typography);
 draft.categories??=categoryList(draft);
 draft.copy??={};draft.font??={url:'',name:''};
 $$('[data-edit-tab]').forEach(b=>b.classList.toggle('active',b.dataset.editTab===editTab));let html='';
 if(editTab==='text'){
 html='<p class="help">这里修改页面标题、导航、提示和页尾文字。个人资料、技能、优势和作品文字请在对应页签编辑。标题支持换行。</p>'+copyFields.map(([key,label,,fallback])=>field(label,'copy.'+key,draft.copy[key]??fallback,'textarea')).join('');
 }else if(editTab==='font'){
 html='<h3>网站字体</h3><p class="help">支持 WOFF2、WOFF、TTF、OTF，最大 20 MB。上传后点击预览或保存，字体应用于整个作品集；缺少的中文字会使用系统字体。</p>'+uploader('上传字体','font.url','.woff2,.woff,.ttf,.otf')+'<p>当前字体：'+escape(draft.font.name||'系统默认')+'</p><button type="button" class="small-button" data-reset-font>恢复默认字体</button>';
  html+=typeControls();
 }else if(editTab==='theme'){
  draft.appearance??={theme:'sky'};
  html='<h3>主题配色</h3><p class="help">选择后即时预览，点击保存更改，重新打开仍会保留。</p><div class="theme-options">'+[['sky','晴空蓝','清透海蓝 · 轻盈白昼'],['rose','樱花粉','柔粉暖白 · 浪漫花园'],['mint','薄荷绿','清新青绿 · 自然呼吸'],['apricot','暖杏金','杏色香槟 · 温柔日光'],['black','曜石黑','深色空间 · 柔和光晕'],['white','纯净白','无彩白昼 · 简洁通透']].map(([id,name,desc])=>`<button type="button" class="theme-option" data-theme-choice="${id}" aria-pressed="${(draft.appearance.theme||'sky')===id}"><span class="theme-swatch swatch-${id}"></span><strong>${name}</strong><span>${desc}</span></button>`).join('')+'</div>'+`<label class="field saturation-control">背景颜色饱和度 <output>${draft.appearance.saturation??65}%</output><input type="range" min="0" max="100" data-key="appearance.saturation" value="${draft.appearance.saturation??65}" aria-label="背景颜色饱和度"></label><p class="help">向左更柔和，向右更鲜明。黑白主题保持无彩色。</p>`;
 }else if(editTab==='profile'){
  const p=draft.profile;html=field('姓名','profile.name',p.name)+field('职业 / 身份','profile.role',p.role)+field('个人介绍','profile.bio',p.bio,'textarea')+'<div class="field-row">'+field('邮箱','profile.email',p.email,'email')+field('电话','profile.phone',p.phone,'tel')+'</div>'+field('微信','profile.wechat',p.wechat)+uploader('上传头像','profile.avatar')+(p.avatar?imageTag(p.avatar,'头像预览','upload-preview')+'<button type="button" class="small-button" data-clear-avatar>移除头像</button>':'')+'<h3>技能条</h3>'+p.skills.map((s,i)=>`<div class="edit-block">${field('技能名称',`profile.skills.${i}.name`,s.name)}<label class="field">熟练度 <output id="skill-value-${i}">${s.value}%</output><input type="range" min="0" max="100" data-key="profile.skills.${i}.value" value="${s.value}"></label><div class="skill-actions"><button type="button" class="small-button" data-skill-up="${i}" ${i===0?'disabled':''} aria-label="上移技能 ${escape(s.name)}">↑ 上移</button><button type="button" class="small-button" data-skill-down="${i}" ${i===p.skills.length-1?'disabled':''} aria-label="下移技能 ${escape(s.name)}">↓ 下移</button><button type="button" class="small-button danger" data-remove-skill="${i}">移除此技能</button></div></div>`).join('')+'<button type="button" class="small-button" data-add-skill>＋ 添加技能</button>';
 }else if(editTab==='strengths'){
  html=draft.strengths.map((s,i)=>`<div class="edit-block"><h3>个人优势</h3>${field('标题',`strengths.${i}.title`,s.title)}${field('英文标签',`strengths.${i}.en`,s.en)}${field('描述',`strengths.${i}.text`,s.text,'textarea')}<div class="block-actions"><button type="button" class="small-button danger" data-remove-strength="${i}">移除此优势</button></div></div>`).join('')+'<button type="button" class="small-button" data-add-strength>＋ 添加优势</button>';
 }else{
  html='<div class="work-editor-toolbar"><label class="field">作品分类<select id="editorWorkCategory">'+categoryList(draft).map(c=>`<option ${c===editorWorkCategory?'selected':''}>${escape(c)}</option>`).join('')+'</select></label><button type="button" class="primary" data-add-work>＋ 增加作品</button></div><div class="category-add"><label class="field">新作品分类<input id="newCategoryName" maxlength="30" placeholder="输入分类名称"></label><button type="button" class="small-button" data-add-category>＋ 增加分类</button><button type="button" class="small-button" data-rename-category>重命名当前分类</button></div><p class="help">可继续增加作品，上传图片或视频后保存。</p>'+draft.works.map((w,i)=>({w,i})).filter(({w})=>w.category===editorWorkCategory).map(({w,i})=>`<div class="edit-block" data-editor-work="${escape(w.id)}"><h3>${escape(w.title)}</h3>${field('作品名称',`works.${i}.title`,w.title)}<div class="field-row"><label class="field">分类<select data-key="works.${i}.category">${categoryList(draft).map(c=>`<option ${w.category===c?'selected':''}>${escape(c)}</option>`).join('')}</select></label></div>${field('英文副标题',`works.${i}.subtitle`,w.subtitle)}${field('作品说明 / 职责 / 创作过程',`works.${i}.description`,w.description,'textarea')}<label class="field"><input type="checkbox" data-key="works.${i}.demo" ${w.demo?'checked':''}>标记为示例 / 待添加</label>${uploader('封面图片',`works.${i}.cover`)}${w.cover?imageTag(w.cover,'封面预览','upload-preview')+`<button type="button" class="small-button" data-clear-cover="${i}">移除封面</button>`:''}${uploader('添加作品图片或视频（支持多选）',`works.${i}.media`,'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm',true)}${w.media.map((m,j)=>`<div class="asset-row"><span>${m.type==='video'?'视频':'图片'} ${j+1} · ${escape(m.name||'作品素材')}</span><button type="button" class="small-button" data-media-up="${i}:${j}" ${j===0?'disabled':''}>上移</button><button type="button" class="small-button" data-media-down="${i}:${j}" ${j===w.media.length-1?'disabled':''}>下移</button><button type="button" class="small-button danger" data-remove-media="${i}:${j}">移除</button></div>`).join('')}<div class="block-actions"><button type="button" class="small-button" data-work-up="${i}" ${previousWorkIndex(draft.works,i)<0?'disabled':''}>上移作品</button><button type="button" class="small-button" data-work-down="${i}" ${nextWorkIndex(draft.works,i)<0?'disabled':''}>下移作品</button><button type="button" class="small-button danger" data-remove-work="${i}">移除作品</button></div></div>`).join('');
 }
 $('#editForm').innerHTML=html;
}
function markDirty(){dirty=true;text('#saveStatus','有未保存的更改');$('#saveStatus').classList.add('saving-note');text('#editToggle','继续编辑 · 未保存 ↗')}
function setPath(path,value){const parts=path.split('.');let obj=draft;for(const part of parts.slice(0,-1))obj=obj[part];obj[parts.at(-1)]=value}
function openEditor(){if(hostedMode&&!canEditHere){location.assign('/admin');return}if(!draft)draft=clone(content);renderEditor();$('#editor').showModal();document.body.style.overflow='hidden'}
function closeEditor(preview=false){if(uploadCount){notify('文件正在上传，请稍候');return}if(preview&&dirty){content=clone(draft);render();notify('当前为预览，记得返回编辑器保存')}$('#editor').close();document.body.style.overflow=''}
$('#editToggle').onclick=$('#editFromNav').onclick=openEditor;$('#closeEditor').onclick=()=>closeEditor();$('#previewEdit').onclick=()=>closeEditor(true);$('#editor').addEventListener('cancel',e=>{e.preventDefault();if(filePickerActive){filePickerActive=false;return}closeEditor()});
$$('[data-edit-tab]').forEach(b=>b.onclick=()=>{if(uploadCount){notify('文件正在上传，请稍候');return}editTab=b.dataset.editTab;renderEditor()});
$('#editForm').onsubmit=e=>e.preventDefault();
$('#editForm').addEventListener('input',e=>{const el=e.target;if(!el.dataset.key)return;let value=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;setPath(el.dataset.key,value);if(el.dataset.key==='appearance.saturation')applyAppearance(draft.appearance);if(el.type==='range')el.previousElementSibling.value=value+'%';markDirty()});
$('#editForm').addEventListener('change',async e=>{
 const el=e.target;if(el.id==='editorWorkCategory'){if(uploadCount)return;editorWorkCategory=el.value;renderEditor();return}if(!el.dataset.upload)return;filePickerActive=false;if(!el.files?.length)return;
 const files=[...el.files],target=el.dataset.upload;if(files.some(f=>f.size>150*1024*1024)){notify('文件过大，请将每个文件控制在 150 MB 以内');el.value='';return}
 uploadCount++;$$('#saveEdit,#previewEdit').forEach(b=>b.disabled=true);text('#saveStatus','正在上传…');
 try{
  for(const file of files){const isFont=target==='font.url';const ext=file.name.split('.').pop().toLowerCase();const fontTypes={woff2:'font/woff2',woff:'font/woff',ttf:'font/ttf',otf:'font/otf'};if(isFont&&(!fontTypes[ext]||file.size>20*1024*1024))throw new Error('请选择 20 MB 以内的 WOFF2、WOFF、TTF 或 OTF 字体');if(isFont){const test=new FontFace('UploadCheck',await file.arrayBuffer());await test.load()}const r=await fetch('/api/upload',{method:'POST',headers:{'Content-Type':isFont?fontTypes[ext]:file.type},body:file});const result=await r.json();if(!r.ok)throw new Error(result.error||'上传失败');if(target.endsWith('.media')){const i=Number(target.split('.')[1]);draft.works[i].media.push({url:result.url,type:file.type.startsWith('video/')?'video':'image',name:file.name})}else setPath(target,result.url);if(isFont){draft.font.name=file.name;applyFont(draft.font)}markDirty()}
  renderEditor();notify('上传完成，保存更改后生效');
 }catch(error){notify(error.message+'。已上传的文件仍在草稿中。');text('#saveStatus','上传未完成，可重试')}
 finally{uploadCount--;$$('#saveEdit,#previewEdit').forEach(b=>b.disabled=false)}
});
$('#editForm').onclick=e=>{
 const themeButton=e.target.closest('[data-theme-choice]');if(themeButton){draft.appearance={...draft.appearance,theme:themeButton.dataset.themeChoice};applyAppearance(draft.appearance);markDirty();renderEditor();return}
 if(e.target.matches('input[type=file]')){filePickerActive=true;return}const b=e.target.closest('button');if(!b||uploadCount)return;const d=b.dataset;
 if('resetFont'in d){draft.font={url:'',name:''};applyFont(draft.font);markDirty();renderEditor();return}
 if('renameCategory'in d){const name=$('#newCategoryName').value.trim();if(!name){notify('请在分类名称框填写新名称');return}if(name==='全部作品'||categoryList(draft).includes(name)){notify('这个名称已存在');return}draft.categories=categoryList(draft).map(c=>c===editorWorkCategory?name:c);draft.works.forEach(w=>{if(w.category===editorWorkCategory)w.category=name});editorWorkCategory=name;markDirty();renderEditor();return}
 if('addCategory'in d){const name=$('#newCategoryName').value.trim();if(!name){notify('请填写分类名称');return}if(name==='全部作品'||categoryList(draft).includes(name)){notify('这个分类已存在');return}draft.categories=[...(draft.categories||[]),name];editorWorkCategory=name;markDirty();renderEditor();return}
 if('addSkill'in d)draft.profile.skills.push({name:'新技能',value:80});
 else if('skillUp'in d||'skillDown'in d){const i=Number(d.skillUp??d.skillDown),j=i+('skillUp'in d?-1:1);if(!Number.isInteger(i)||i<0||i>=draft.profile.skills.length||j<0||j>=draft.profile.skills.length)return;[draft.profile.skills[i],draft.profile.skills[j]]=[draft.profile.skills[j],draft.profile.skills[i]]}
 else if('removeSkill'in d)draft.profile.skills.splice(Number(d.removeSkill),1);
 else if('clearAvatar'in d)draft.profile.avatar='';
 else if('addStrength'in d)draft.strengths.push({title:'新的优势',en:'MY STRENGTH',text:''});
 else if('removeStrength'in d)draft.strengths.splice(Number(d.removeStrength),1);
 else if('addWork'in d){draft.works.unshift({id:crypto.randomUUID(),category:editorWorkCategory,title:'新作品',subtitle:'NEW PROJECT',year:String(new Date().getFullYear()),description:'',cover:'',media:[],demo:false})}
 else if('removeWork'in d)draft.works.splice(Number(d.removeWork),1);
 else if('clearCover'in d)draft.works[Number(d.clearCover)].cover='';
 else if('workUp'in d){const i=Number(d.workUp),previous=previousWorkIndex(draft.works,i);if(previous<0)return;[draft.works[previous],draft.works[i]]=[draft.works[i],draft.works[previous]]}
 else if('workDown'in d){const i=Number(d.workDown),next=nextWorkIndex(draft.works,i);if(next<0)return;[draft.works[next],draft.works[i]]=[draft.works[i],draft.works[next]]}
 else if('removeMedia'in d){const [i,j]=d.removeMedia.split(':').map(Number);draft.works[i].media.splice(j,1)}
 else if('mediaDown'in d){const [i,j]=d.mediaDown.split(':').map(Number);const media=draft.works[i]?.media;if(!media||!Number.isInteger(j)||j<0||j>=media.length-1)return;[media[j],media[j+1]]=[media[j+1],media[j]]}
 else if('mediaUp'in d){const [i,j]=d.mediaUp.split(':').map(Number);if(j>0)[draft.works[i].media[j-1],draft.works[i].media[j]]=[draft.works[i].media[j],draft.works[i].media[j-1]]}
 else return;markDirty();const y=$('#editForm').scrollTop;renderEditor();$('#editForm').scrollTop='addWork'in d?0:y;if('addWork'in d)$('#editForm input[data-key$=".title"]')?.focus();
};
$('#saveEdit').onclick=async()=>{
 if(uploadCount)return;if(!draft.profile.name.trim()){notify('请填写姓名');return}if(draft.works.some(w=>!w.title.trim())){notify('请为每个作品填写名称');return}
 const button=$('#saveEdit'),snapshot=clone(draft);button.disabled=true;text('#saveStatus','正在保存…');
 try{const response=await fetch('/api/content',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});const result=await response.json();if(!response.ok)throw new Error(result.error||'保存失败');content=snapshot;dirty=JSON.stringify(draft)!==JSON.stringify(snapshot);render();if(dirty){markDirty();notify('上一版已保存，新修改仍需保存')}else{text('#saveStatus',hostedMode?'已保存到云端':'已保存到本机');$('#saveStatus').classList.remove('saving-note');text('#editToggle',copyValue('edit'));notify('已保存，重新打开仍会保留')}}
 catch(e){text('#saveStatus','保存失败，草稿已保留');notify(e.message+'，请检查作品集服务是否运行')}
 finally{button.disabled=false}
};
window.addEventListener('beforeunload',e=>{remember();if(dirty||uploadCount){e.preventDefault();e.returnValue=''}});
async function start(){
 try{const response=await fetch('/api/content');if(!response.ok)throw new Error('无法读取作品集');content=await response.json();try{const session=await fetch('/api/session').then(r=>r.json());hostedMode=session.hosted;canEditHere=session.canEdit}catch{}render();if(hostedMode){$('.editor-intro').textContent='修改后可预览；点击保存，将内容与上传文件保存到云端。';if(location.pathname==='/admin'&&canEditHere)openEditor()}
  try{const saved=JSON.parse(sessionStorage.getItem('folio-view')||'null');if(saved){filter=categories.includes(saved.filter)?saved.filter:'全部作品';workPosition=saved.workPosition;renderWorks();if(saved.section==='studio'){$('#studio').hidden=false;requestAnimationFrame(()=>window.scrollTo({top:saved.y||0,behavior:'instant'}))}}}catch{}
  history.replaceState(null,'',location.pathname);
 }catch(e){$('#editToggle').disabled=true;notify(e.message)}
}
// Scroll choreography uses native scrolling so dialogs and saved positions stay exact.
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const motionSeen=new WeakSet();
const entranceObserver=new IntersectionObserver(entries=>{
 for(const entry of entries){
  if(!entry.isIntersecting)continue;
  const el=entry.target;entranceObserver.unobserve(el);
  if(motionPreference.matches)continue;
  const siblings=[...el.parentElement.children],index=siblings.indexOf(el);
  el.animate([{opacity:0,translate:'0 50px'},{opacity:1,translate:'0 0'}],{duration:1050,delay:el.matches('.work-card,.strength-card')?(index%3)*90:0,easing:'cubic-bezier(.16,1,.3,1)'});
 }
},{threshold:0,rootMargin:'0px 0px -35px 0px'});
let motionFrame=0;
function updateScrollMotion(){
 motionFrame=0;
 if($('#studio').hidden||$('#detail').open||$('#editor').open)return;
 const vh=innerHeight;
 $$('#studio .section-heading h2,#bio').forEach(el=>{
  const r=el.getBoundingClientRect();
  const progress=motionPreference.matches?1:Math.max(0,Math.min(1,(vh*.9-r.top)/(vh*.42)));
  el.style.setProperty('--read-progress',`${progress*100}%`);
 });
 $$('.work-cover img,.portrait img').forEach(el=>{
  const r=el.parentElement.getBoundingClientRect();if(r.bottom<0||r.top>vh)return;
  const offset=motionPreference.matches?0:((vh/2-r.top-r.height/2)/(vh+r.height))*24;
  el.style.setProperty('--image-offset',`${offset}px`);
 });
}
function queueScrollMotion(){if(!motionFrame)motionFrame=requestAnimationFrame(updateScrollMotion)}
function observeScrollContent(){
 $$('#studio .section-heading,.about-grid>div,.strength-card,.work-card,#studio footer').forEach(el=>{
  if(motionSeen.has(el))return;motionSeen.add(el);entranceObserver.observe(el);
 });queueScrollMotion();
}
new MutationObserver(observeScrollContent).observe($('#studio'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
window.addEventListener('scroll',queueScrollMotion,{passive:true});
window.addEventListener('resize',queueScrollMotion,{passive:true});
motionPreference.addEventListener('change',()=>{if(motionPreference.matches)$$('#studio *').forEach(el=>el.getAnimations().forEach(a=>a.cancel()));queueScrollMotion()});
observeScrollContent();
start();

// Small, bounded pointer particles; no timers or rendering loop when idle.
const cursorGarden=document.createElement('div');cursorGarden.className='cursor-garden';cursorGarden.setAttribute('aria-hidden','true');document.body.append(cursorGarden);
const flowerSVG='<svg viewBox="0 0 40 40" aria-hidden="true"><g fill="currentColor" opacity=".85"><ellipse cx="20" cy="11" rx="6" ry="10"/><ellipse cx="20" cy="11" rx="6" ry="10" transform="rotate(72 20 20)"/><ellipse cx="20" cy="11" rx="6" ry="10" transform="rotate(144 20 20)"/><ellipse cx="20" cy="11" rx="6" ry="10" transform="rotate(216 20 20)"/><ellipse cx="20" cy="11" rx="6" ry="10" transform="rotate(288 20 20)"/></g><circle cx="20" cy="20" r="4" fill="#e6c787"/></svg>';
let lastBloomTime=0,lastBloomX=0,lastBloomY=0,trailSequence=0;
function bloomAt(x,y,ring=false){
 if(cursorGarden.childElementCount>=60)return;
 const flower=document.createElement('span');
 const phase=ring?-1:trailSequence++%10;
 const kind=ring?'ring':phase===0?'flower':[2,5,8].includes(phase)?'dew':phase===4?'star':'dust';
 const size=ring?44:kind==='flower'?30+Math.random()*12:kind==='dew'?14+Math.random()*20:kind==='star'?12+Math.random()*10:3+Math.random()*4;
 flower.className={ring:'click-bloom',flower:'cursor-glass-blossom',dew:'cursor-dewdrop',star:'cursor-champagne-star',dust:'cursor-champagne-dust'}[kind];
 if(kind==='flower'){for(let i=0;i<5;i++){const petal=document.createElement('i');petal.style.setProperty('--turn',`${i*72}deg`);flower.append(petal)}flower.append(document.createElement('b'))}
 flower.style.width=size+'px';flower.style.height=size+'px';flower.style.left=x-size/2+'px';flower.style.top=y-size/2+'px';cursorGarden.append(flower);
 const turn=Math.random()*90-45;
 const animation=flower.animate(ring?[{opacity:.8,transform:'scale(.3)'},{opacity:0,transform:'scale(1.8)'}]:[{opacity:.85,transform:`translate(0,0) rotate(${turn}deg) scale(.55)`},{opacity:.8,offset:.2,transform:`translate(0,-3px) rotate(${turn+8}deg) scale(1)`},{opacity:0,transform:`translate(${Math.random()*26-13}px,-32px) rotate(${turn+25}deg) scale(.3)`}],{duration:ring?450:1200,easing:'ease-out'});
 animation.onfinish=()=>flower.remove();animation.oncancel=()=>flower.remove();
}
document.addEventListener('pointermove',e=>{
 if(e.pointerType!=='mouse'||motionPreference.matches||document.hidden||e.target.closest('dialog'))return;
 const now=performance.now();if(now-lastBloomTime<40||Math.hypot(e.clientX-lastBloomX,e.clientY-lastBloomY)<8)return;
 lastBloomTime=now;lastBloomX=e.clientX;lastBloomY=e.clientY;bloomAt(e.clientX,e.clientY);bloomAt(e.clientX+Math.random()*22-11,e.clientY+Math.random()*22-11);
},{passive:true});
document.addEventListener('pointerdown',e=>{if(e.button!==0||motionPreference.matches||e.target.closest('dialog'))return;bloomAt(e.clientX,e.clientY,true)},{passive:true});
function clearBlooms(){cursorGarden.replaceChildren()}
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearBlooms()});
motionPreference.addEventListener('change',()=>{if(motionPreference.matches)clearBlooms()});
