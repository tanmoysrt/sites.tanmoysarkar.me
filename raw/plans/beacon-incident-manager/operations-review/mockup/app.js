class OperationsReview {
  constructor(data) {
    this.pages = data.pages;
    const requested = new URLSearchParams(location.search).get('page') || document.body.dataset.page;
    this.page = this.pages.find(page => page.id === requested) || this.pages[0];
    this.tab = this.page.tabs[0];
    this.mode = 'record';
    this.renderNavigation();
    document.querySelector('#page-picker').addEventListener('change', event => this.open(event.target.value));
    document.querySelector('#dialog').addEventListener('close', event => {
      if (event.target.returnValue === 'confirm') this.notify('Demo preview only. No Beacon record was changed.');
    });
    this.render();
  }

  open(id) {
    this.page = this.pages.find(page => page.id === id) || this.page;
    this.tab = this.page.tabs[0];
    this.mode = 'record';
    history.replaceState(null, '', `?page=${this.page.id}`);
    this.renderNavigation();
    this.render();
  }

  renderNavigation() {
    document.querySelector('#page-picker').innerHTML = this.pages.map(page => `<option value="${page.id}" ${page.id === this.page.id ? 'selected' : ''}>${this.text(page.name)}</option>`).join('');
    const groups = [['Operations',['incident','alert','maintenance','silence']],['Health',['state','region']],['Configuration',['rule','service','resource','source','settings']],['Logs',['evaluation','notification','minute','day']]];
    document.querySelector('#sidebar').innerHTML = groups.map(([name, ids]) => `<div class="nav-group">${name}</div>${ids.map(id => {
      const page = this.pages.find(item => item.id === id);
      return `<button class="nav-item ${id === this.page.id ? 'active' : ''}" data-page="${id}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12h8M12 8v8"/></svg>${this.text(page.name)}</button>`;
    }).join('')}`).join('');
    document.querySelectorAll('[data-page]').forEach(button => button.onclick = () => this.open(button.dataset.page));
  }

  render() {
    const page = this.page;
    const banner = page.id === 'settings' ? 'Paging is paused. New incident records still need attention. Resume explicitly after the drill.' : page.id === 'source' ? 'The last fetch failed. Existing resources are retained; held removals require review.' : '';
    document.querySelector('#main').innerHTML = `<div class="breadcrumb">Beacon / ${this.text(page.name)}</div>
      <div class="heading"><h1>${this.text(page.name)}</h1><div class="mode"><button data-mode="record" class="${this.mode === 'record' ? 'selected' : ''}">Record</button><button data-mode="list" class="${this.mode === 'list' ? 'selected' : ''}">List priority</button></div></div>
      <p class="question">${this.text(page.question)}</p>${banner ? `<div class="banner">${banner}</div>` : ''}
      ${this.mode === 'record' ? this.record() : this.list()}
      <div class="rationale"><h3>Why this order</h3><p>${this.text(page.first)}</p><details><summary>Fields kept later</summary><p>${this.text(page.later)}</p></details><p>Proposed layout. Values are illustrative. Summary values are derived from existing records; they do not add stored state.</p></div>`;
    document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => {this.mode = button.dataset.mode;this.render();});
    document.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => {this.tab = button.dataset.tab;this.render();});
    document.querySelectorAll('[data-action]').forEach(button => button.onclick = () => this.action(button.dataset.action));
    document.querySelectorAll('[data-link]').forEach(link => link.onclick = event => {event.preventDefault();this.open(link.dataset.link);});
    document.querySelectorAll('.list-row').forEach(row => row.onclick = () => {this.mode = 'record';this.render();});
  }

  record() {
    const page = this.page;
    const panel = PANELS[page.id][this.tab];
    const summaryIndices = page.id === 'incident' ? [1,2,4,6] : [0,1,2,3];
    const summary = summaryIndices.map(index => page.fields[index]).map(([label, value]) => `<div class="stat"><span class="label">${this.text(label)}</span><strong>${this.text(value)}</strong></div>`).join('');
    const tabs = page.tabs.map(tab => `<button role="tab" aria-selected="${tab === this.tab}" class="tab ${tab === this.tab ? 'selected' : ''}" data-tab="${this.text(tab)}">${this.text(tab)}</button>`).join('');
    const remainingFields = page.fields.filter((field,index) => !summaryIndices.includes(index));
    const fields = this.fields(panel.fields || (this.tab === page.tabs[0] ? remainingFields : []));
    const rows = (panel.rows || []).map(([title, description, state]) => `<div class="row"><div><b>${this.text(title)}</b><small>${this.text(description)}</small></div><span class="state ${['Firing','Failed','Major Outage'].includes(state) ? '' : 'neutral'}">${this.text(state)}</span></div>`).join('');
    const secondary = page.secondary.map(action => `<button data-action="${this.text(action)}">${this.text(action)}</button>`).join('');
    const links = page.links.map(id => `<a href="?page=${id}" data-link="${id}">Open ${this.text(this.pages.find(item => item.id === id).name)} →</a>`).join('');
    return `<div class="summary">${summary}</div><div class="tabs" role="tablist" aria-label="Form sections">${tabs}</div><section class="panel" role="tabpanel"><h2>${this.text(panel.title)}</h2>${fields}${rows}${panel.note ? `<p class="hint">${this.text(panel.note)}</p>` : ''}</section><div class="actions"><button class="primary" data-action="${this.text(page.primary)}">${this.text(page.primary)}</button>${secondary}</div><h3>Related records</h3><div class="related">${links}</div>`;
  }

  list() {
    const page = this.page;
    if (page.id === 'settings') return '<p>Settings is a singleton. Open the On-call form directly; it does not need an artificial list.</p><button class="primary" data-action="Open settings">Open settings</button>';
    const columns = LISTS[page.id];
    return `<section class="panel"><h2>Useful columns first</h2><p class="hint">${this.text(page.columns)}</p><div class="list-grid"><table><thead><tr>${columns.map(([label]) => `<th>${this.text(label)}</th>`).join('')}</tr></thead><tbody><tr class="list-row">${columns.map(([,value]) => `<td>${this.text(value)}</td>`).join('')}</tr></tbody></table></div><p class="hint">Column order proposal. The row is illustrative; click it to return to the form. Configure columns from existing fields or an approved permission-aware query.</p></section>`;
  }

  fields(values) {
    return `<div class="fields">${values.map(([label,value]) => `<div class="field"><span class="label">${this.text(label)}</span><div class="value">${this.text(value)}</div></div>`).join('')}</div>`;
  }

  action(name) {
    const target = { 'Open incident':'incident', 'Open rule':'rule', 'Open service':'service', 'Open service health':'state', 'Open on-call settings':'settings', 'Open settings':'settings', 'View minutes':'minute', 'View recent minutes':'minute', 'View daily history':'day', 'Open evaluations':'evaluation', 'Open source':'source', 'Open region':'region' }[name];
    if (target) return this.open(target);
    if (name === 'Review removals') {this.tab = 'Removal review';this.render();return;}
    let content;
    let confirm = 'Confirm in demo';
    if (name === 'Publish') {
      const maintenance = this.page.id === 'maintenance';
      const message = maintenance ? 'Host maintenance is scheduled in Region A from 14:00 to 14:30 UTC. Sites can be unavailable during this window.' : 'We are investigating host connectivity in Region A. Sites can be unavailable. The next update is at 14:20 UTC.';
      content = '<p>Preview exactly what customers will see. Existing impact rows remain selected.</p><label>Visibility<select><option>Public</option><option>Unlisted</option></select></label>' + this.fields([['Service','Sites'],['Region','Region A'],['Impact',maintenance ? 'Maintenance' : 'Major Outage'],['Title',maintenance ? 'Planned host maintenance' : 'Host unreachable']]) + `<label>Customer message<textarea>${message}</textarea></label><p class="hint">Internal investigation notes are excluded. Blank region means all regions. An information-only notice needs an explicit choice.</p>`;
      confirm = 'Publish in demo';
    } else if (name === 'Resolve') {
      content = '<div class="banner">2 unsuppressed alerts are still firing.</div><p>The existing resolution guard blocks this action. Verify recovery or create a deliberate, scoped silence first.</p><p><a href="?page=silence" id="silence-link">Review a scoped silence →</a></p>';
      confirm = 'Close preview';
    } else if (name === 'Silence' || name === 'Save silence' || name === 'Extend') {
      content = '<p>Preview the full scope before suppression.</p><label>Reason<input value="Planned host work" required></label><label>Expires at · UTC<input type="text" value="Today, 14:30 UTC" required></label>' + this.fields([['Resource','host-01 and descendants'],['Rule','Host unreachable'],['Region','Region A'],['Matches','3 resources · 2 open alerts']]) + '<p class="hint">Blank match fields are wildcards. At least one match field is required. Expiry is limited to 30 days.</p>';
    } else if (name.includes('held') || name.includes('Held')) {
      content = '<div class="banner">24 resources will be removed, including descendants.</div><p>The first 20 records are a sample. Open the complete filtered resource list before confirming. A failed fetch alone must never remove resources.</p><p>Scope: Region A · infrastructure source. Check the upstream response and any import conflicts first.</p>';
      confirm = 'Apply 24 removals in demo';
    } else if (name === 'Override primary') {
      content = '<label>Primary responder<select required><option>On-call engineer</option><option>Backup engineer</option></select></label><label>Override until · UTC<input value="Today, 18:00 UTC" required></label><p>The normal call order resumes when this override expires. Show the effective primary immediately after Save.</p>';
      confirm = 'Apply override in demo';
    } else if (/Disable|Resume paging|Revoke/.test(name)) {
      content = this.fields([['Record',this.page.fields[0][1]],['Current state',this.page.id === 'settings' ? 'Paging paused' : 'Active'],['Requested action',name]]) + '<p>Apply this change only to the displayed record. The real dialog must show descendant scope where relevant. Keep the change and its author in the document history.</p>';
    } else if (/Start now|Cancel/.test(name)) {
      content = this.fields([['Maintenance','Planned host maintenance'],['Scope','host-01 and descendants'],['Current window','14:00 to 14:30 UTC'],['Requested action',name]]) + '<p>Check publication and exclusion eligibility again at submission. Cancellation must make the end of any active exclusion clear.</p>';
    } else if (/test|connection/i.test(name) && !/page/i.test(name)) {
      content = '<p>The proposed flow runs this read directly. This panel shows the result format.</p>' + this.fields([['Region','Region A'],['Result','Success'],['Duration','82 ms'],['Rows','2 issue rows']]) + '<details><summary>Result sample</summary><p>host-01 · connectivity check failed<br>host-02 · connectivity check failed</p></details><p class="hint">No live query was executed. The real view must distinguish zero issues, no usable measurements and a query error.</p>';
      confirm = 'Done';
    } else if (/page|on-call/i.test(name)) {
      content = '<p>Confirm channel, destination and recipient before sending.</p><label>Channel<select><option>Call</option><option>Email</option></select></label><label>Recipient<select required><option>On-call engineer · configured destination</option></select></label><p class="hint">The recipient must have an effective destination for this channel. A call can incur a provider charge. Administrative test actions stay hidden from responders.</p>';
    } else if (name === 'Post update') {
      content = '<label>Incident status<select><option selected>Investigating</option><option>Identified</option><option>Monitoring</option></select></label><label>Audience<select><option>Internal</option><option>Published incident audience</option></select></label><label>Update<textarea>Host network is under investigation. Next update at 14:20 UTC.</textarea></label>';
      confirm = 'Post update in demo';
    } else {
      content = `<p>${this.text(name)} uses the existing document action and permission checks.</p><p>Show the affected record, current state and exact effect before risky changes. Queued work must link to its eventual result.</p>`;
    }
    document.querySelector('#dialog-body').innerHTML = `<h2>${this.text(name)}</h2>${content}`;
    document.querySelector('#confirm').textContent = confirm;
    document.querySelector('#silence-link')?.addEventListener('click', event => {event.preventDefault();document.querySelector('#dialog').close();this.open('silence');});
    document.querySelector('#dialog').showModal();
  }

  notify(message) {
    const toast = document.querySelector('#toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {toast.style.display = 'none';}, 3500);
  }

  text(value) {
    return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  }
}

new OperationsReview(REVIEW);
