/* Tether owner console.
   Served inside the owner HUD by tether_console.lsl, which answers /poll, /near and /cmd.
   Opened anywhere else (for example straight from GitHub Pages) it runs against a
   built-in demo so the interface can be worked on without logging in to Second Life. */
(function () {
  'use strict';

  var CATALOG = [
    { name: 'Speech', items: [
      ['sendchat', 'Speak', 'Cannot talk in local chat'],
      ['chatshout', 'Shout', 'Cannot shout'],
      ['chatnormal', 'Normal voice', 'Everything said comes out as a whisper'],
      ['sendgesture', 'Gestures', 'Cannot use gestures'],
      ['recvchat', 'Hear chat', 'Cannot hear local chat'],
      ['recvemote', 'See emotes', 'Cannot see emotes']
    ]},
    { name: 'Messages', items: [
      ['sendim', 'Send IMs', 'Cannot send instant messages'],
      ['recvim', 'Read IMs', 'Cannot read instant messages'],
      ['startim', 'Start IMs', 'Cannot open a new conversation']
    ]},
    { name: 'Travel', items: [
      ['tplm', 'Landmarks', 'Cannot teleport with landmarks'],
      ['tploc', 'Map teleport', 'Cannot teleport from the map'],
      ['tplure', 'Accept offers', 'Cannot accept teleport offers'],
      ['tprequest', 'Request teleports', 'Cannot ask to be teleported'],
      ['sittp', 'Sit far away', 'Cannot sit on things out of reach'],
      ['fly', 'Fly', 'Cannot fly'],
      ['unsit', 'Stand up', 'Cannot get up once seated'],
      ['sit', 'Sit down', 'Cannot sit on anything']
    ]},
    { name: 'Senses', items: [
      ['shownames', 'See names', 'Names of others are hidden'],
      ['shownametags', 'See name tags', 'Name tags are hidden'],
      ['showloc', 'Know location', 'Region and parcel are hidden'],
      ['showworldmap', 'World map', 'Cannot open the world map'],
      ['showminimap', 'Mini map', 'Cannot open the mini map'],
      ['showhovertextall', 'Hover text', 'Floating text is hidden']
    ]},
    { name: 'World', items: [
      ['touchworld', 'Touch objects', 'Cannot touch objects in the world'],
      ['fartouch', 'Touch from afar', 'Can only touch things within reach'],
      ['edit', 'Edit', 'Cannot edit objects'],
      ['rez', 'Rez', 'Cannot rez objects'],
      ['showinv', 'Inventory', 'Cannot open inventory'],
      ['viewnote', 'Notecards', 'Cannot read notecards'],
      ['setgroup', 'Change group', 'Cannot change the active group']
    ]},
    { name: 'Wardrobe', items: [
      ['addoutfit', 'Put on clothes', 'Cannot add clothing layers'],
      ['remoutfit', 'Take off clothes', 'Cannot remove clothing layers'],
      ['addattach', 'Add attachments', 'Cannot attach anything'],
      ['remattach', 'Remove attachments', 'Cannot detach anything']
    ]}
  ];
  var RELAY = ['Off', 'Ask', 'Auto'];
  var RANKS = { '3': 'Owner', '2': 'Trusted', '-1': 'Blocked' };

  var state = { subs: {}, order: [], sel: null, tab: 'overview', near: [], toast: null };
  var root = document.getElementById('app');

  /* ---------- transport ---------- */

  var live = /\/cap\//.test(location.pathname);
  var base = location.href.replace(/[?#].*$/, '').replace(/\/+$/, '');
  var transport = live ? liveTransport() : demoTransport();

  function liveTransport() {
    function poll() {
      fetch(base + '/poll').then(function (r) { return r.json(); }).then(function (events) {
        events.forEach(receive);
        poll();
      }).catch(function () { setTimeout(poll, 2000); });
    }
    return {
      start: poll,
      send: function (to, m) {
        return fetch(base + '/cmd', { method: 'POST', body: JSON.stringify({ to: to, m: m }) });
      },
      near: function () {
        return fetch(base + '/near').then(function (r) { return r.json(); });
      }
    };
  }

  function demoTransport() {
    var subs = {
      'a1': { t: 'st', k: 'a1', n: 'Wren Ashdown', v: '0.1.0', rank: 3, rlv: 1, lock: 3, relay: 1, ses: 1,
              sit: 0, reg: 'Halcyon Reach', rs: 'sendim,tplm,tploc,showloc' },
      'b2': { t: 'st', k: 'b2', n: 'Juno Vale', v: '0.1.0', rank: 2, rlv: 1, lock: 0, relay: 2, ses: 0,
              sit: 1, reg: 'Halcyon Reach', rs: '' }
    };
    var acc = {
      'a1': [{ k: 'me', r: 3, n: 'You' }, { k: 'c3', r: 2, n: 'Mara Quill' }],
      'b2': [{ k: 'd4', r: 3, n: 'Corin Hale' }, { k: 'me', r: 2, n: 'You' }]
    };
    function push(k) { setTimeout(function () { receive(JSON.parse(JSON.stringify(subs[k]))); }, 120); }
    function handle(k, m) {
      var s = subs[k]; if (!s) return;
      var rs = s.rs ? s.rs.split(',') : [];
      if (m.c === 'lock') { if (m.v) { if (!s.lock) s.lock = s.rank; } else if (s.rank >= s.lock) s.lock = 0; }
      if (m.c === 'rlv') { rs = rs.filter(function (b) { return b !== m.b; }); if (m.v) rs.push(m.b); s.rs = rs.join(','); }
      if (m.c === 'clear') s.rs = '';
      if (m.c === 'force') s.sit = m.f === 'sitground' ? 1 : 0;
      if (m.c === 'relay' && s.rank === 3) s.relay = m.v;
      if (m.c === 'acc' && s.rank === 3) {
        if (m.op === 'set') {
          acc[k] = acc[k].filter(function (a) { return a.k !== m.k; });
          if (m.r) acc[k].push({ k: m.k, r: m.r, n: m.n });
        }
        setTimeout(function () { receive({ t: 'acc', k: k, l: acc[k].slice() }); }, 120);
      }
      push(k);
    }
    return {
      start: function () { Object.keys(subs).forEach(push); },
      send: function (to, m) {
        if (to === '*') Object.keys(subs).forEach(push); else handle(to, m);
        return Promise.resolve();
      },
      near: function () {
        return Promise.resolve([{ k: 'e5', n: 'Tamsin Roe' }, { k: 'f6', n: 'Idris Crane' }]);
      }
    };
  }

  function receive(ev) {
    if (ev.t === 'st') {
      var old = state.subs[ev.k] || {};
      ev.acc = old.acc;
      state.subs[ev.k] = ev;
      if (state.order.indexOf(ev.k) === -1) state.order.push(ev.k);
      if (!state.sel) state.sel = ev.k;
    } else if (ev.t === 'acc') {
      if (state.subs[ev.k]) state.subs[ev.k].acc = ev.l;
    } else if (ev.t === 'ev') {
      var s = state.subs[ev.k];
      var who = s ? s.n : 'Someone';
      if (ev.x === 'safeword') toast(who + ' used their safeword. Everything is released.', true);
      if (ev.x === 'runaway') {
        toast(who + ' ran away. You no longer have access.', true);
        delete state.subs[ev.k];
        state.order = state.order.filter(function (k) { return k !== ev.k; });
        if (state.sel === ev.k) state.sel = state.order[0] || null;
      }
    }
    render();
  }

  function send(m) { if (state.sel) transport.send(state.sel, m); }

  /* ---------- rendering ---------- */

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'on') Object.keys(attrs.on).forEach(function (e) { el.addEventListener(e, attrs.on[e]); });
      else if (k === 'text') el.textContent = attrs.text;
      else if (attrs[k] !== false && attrs[k] != null) el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }

  function toast(text, strong) {
    state.toast = { text: text, strong: strong };
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { state.toast = null; render(); }, strong ? 8000 : 2500);
    render();
  }

  function restricted(s) { return s.rs ? s.rs.split(',') : []; }

  function render() {
    var keepScroll = (root.querySelector('.panel') || {}).scrollTop || 0;
    root.textContent = '';
    root.appendChild(h('div', { class: 'shell' }, [rail(), main()]));
    if (state.toast) root.appendChild(h('div', { class: 'toast' + (state.toast.strong ? ' strong' : ''), text: state.toast.text }));
    var panel = root.querySelector('.panel');
    if (panel) panel.scrollTop = keepScroll;
  }

  function rail() {
    var cards = state.order.map(function (k) {
      var s = state.subs[k];
      var count = restricted(s).length;
      return h('button', { class: 'card' + (k === state.sel ? ' on' : ''), on: { click: function () {
        state.sel = k; state.tab = 'overview'; render();
      } } }, [
        h('span', { class: 'avatar', text: s.n.charAt(0).toUpperCase() }),
        h('span', { class: 'who' }, [
          h('span', { class: 'name', text: s.n }),
          h('span', { class: 'meta', text: (s.lock ? 'Locked' : 'Unlocked') + ' · ' + (count ? count + ' restricted' : 'free') })
        ])
      ]);
    });
    return h('aside', { class: 'rail' }, [
      h('div', { class: 'brand' }, [h('span', { class: 'mark', text: 'Tether' }), live ? null : h('span', { class: 'demo', text: 'demo' })]),
      h('div', { class: 'cards' }, cards.length ? cards : [h('p', { class: 'empty', text: 'Nobody in this region is wearing a Tether you have access to.' })]),
      h('button', { class: 'ghost', text: 'Scan region', on: { click: function () {
        transport.send('*', { c: 'ping' }); toast('Scanning');
      } } })
    ]);
  }

  function main() {
    var s = state.subs[state.sel];
    if (!s) return h('main', { class: 'main' }, [h('div', { class: 'blank' }, [
      h('h1', { text: 'No one selected' }),
      h('p', { text: 'When someone who has given you access is in the region, they appear on the left.' })
    ])]);

    var tabs = [['overview', 'Overview'], ['restrict', 'Restrictions']];
    if (s.rank === 3) tabs.push(['access', 'Access']);
    var body = state.tab === 'restrict' ? restrictTab(s) : state.tab === 'access' ? accessTab(s) : overviewTab(s);

    return h('main', { class: 'main' }, [
      h('header', { class: 'head' }, [
        h('div', {}, [
          h('h1', { text: s.n }),
          h('p', { class: 'sub', text: s.reg + (s.sit ? ' · seated' : ' · standing') + ' · your access: ' + RANKS[s.rank] })
        ]),
        h('nav', { class: 'tabs' }, tabs.map(function (t) {
          return h('button', { class: t[0] === state.tab ? 'on' : '', text: t[1], on: { click: function () {
            state.tab = t[0];
            if (t[0] === 'access') { send({ c: 'acc', op: 'list' }); transport.near().then(function (n) { state.near = n; render(); }); }
            render();
          } } });
        }))
      ]),
      s.rlv ? null : h('div', { class: 'warn', text: s.n + "'s viewer has not answered with RLV. Restrictions are saved and apply as soon as RLV is on." }),
      h('section', { class: 'panel' }, [body])
    ]);
  }

  function toggle(label, hint, on, change, disabled) {
    return h('label', { class: 'row' + (on ? ' on' : '') + (disabled ? ' off' : '') }, [
      h('span', { class: 'label' }, [h('span', { text: label }), hint ? h('small', { text: hint }) : null]),
      h('input', { type: 'checkbox', checked: on ? '' : null, disabled: disabled ? '' : null, on: { change: function (e) { change(e.target.checked); } } }),
      h('span', { class: 'switch' })
    ]);
  }

  function overviewTab(s) {
    var count = restricted(s).length;
    var canUnlock = s.rank >= s.lock;
    var note = h('input', { type: 'text', maxlength: '200', placeholder: 'Send ' + s.n + ' a private line' });
    function sendNote() {
      if (!note.value.trim()) return;
      send({ c: 'msg', x: note.value.trim() }); note.value = ''; toast('Sent');
    }
    note.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendNote(); });

    return h('div', { class: 'grid' }, [
      h('div', { class: 'tile' }, [
        h('h2', { text: 'Lock' }),
        toggle(s.lock ? 'Locked' : 'Unlocked', s.lock && !canUnlock ? 'Locked by an owner' : 'While locked, the Tether cannot be taken off',
          !!s.lock, function (v) { s.lock = v ? s.rank : 0; send({ c: 'lock', v: v ? 1 : 0 }); render(); }, !!s.lock && !canUnlock)
      ]),
      h('div', { class: 'tile' }, [
        h('h2', { text: 'Relay' }),
        h('p', { class: 'hint', text: s.ses ? s.ses + ' object' + (s.ses > 1 ? 's are' : ' is') + ' holding them right now' : 'How furniture and traps may take control' }),
        h('div', { class: 'seg' }, RELAY.map(function (name, i) {
          return h('button', { class: s.relay === i ? 'on' : '', disabled: s.rank < 3 ? '' : null, text: name, on: { click: function () {
            s.relay = i; send({ c: 'relay', v: i }); render();
          } } });
        }))
      ]),
      h('div', { class: 'tile' }, [
        h('h2', { text: 'Posture' }),
        h('div', { class: 'btns' }, [
          h('button', { class: 'ghost', text: 'Sit on the ground', on: { click: function () { send({ c: 'force', f: 'sitground' }); toast('Sent'); } } }),
          h('button', { class: 'ghost', text: 'Stand up', on: { click: function () { send({ c: 'force', f: 'unsit' }); toast('Sent'); } } })
        ])
      ]),
      h('div', { class: 'tile' }, [
        h('h2', { text: 'Restrictions' }),
        h('p', { class: 'big', text: count ? String(count) : 'None' }),
        h('div', { class: 'btns' }, [
          h('button', { class: 'ghost', text: 'Edit', on: { click: function () { state.tab = 'restrict'; render(); } } }),
          h('button', { class: 'ghost', disabled: count ? null : '', text: 'Release all', on: { click: function () { s.rs = ''; send({ c: 'clear' }); render(); } } })
        ])
      ]),
      h('div', { class: 'tile wide' }, [
        h('h2', { text: 'Whisper' }),
        h('div', { class: 'line' }, [note, h('button', { class: 'solid', text: 'Send', on: { click: sendNote } })])
      ])
    ]);
  }

  function restrictTab(s) {
    var active = restricted(s);
    return h('div', { class: 'groups' }, CATALOG.map(function (g) {
      var on = g.items.filter(function (it) { return active.indexOf(it[0]) !== -1; }).length;
      return h('div', { class: 'group' }, [
        h('h2', {}, [h('span', { text: g.name }), on ? h('span', { class: 'count', text: on + ' on' }) : null]),
        h('div', { class: 'rows' }, g.items.map(function (it) {
          return toggle(it[1], it[2], active.indexOf(it[0]) !== -1, function (v) {
            var rs = restricted(s).filter(function (b) { return b !== it[0]; });
            if (v) rs.push(it[0]);
            s.rs = rs.join(',');
            send({ c: 'rlv', b: it[0], v: v ? 1 : 0 });
            render();
          });
        }))
      ]);
    }));
  }

  function accessTab(s) {
    var list = s.acc || [];
    function set(k, r, n) { send({ c: 'acc', op: 'set', k: k, r: r, n: n }); }
    var known = list.map(function (a) { return a.k; });
    var near = state.near.filter(function (a) { return known.indexOf(a.k) === -1 && a.k !== s.k; });

    return h('div', { class: 'groups' }, [
      h('div', { class: 'group' }, [
        h('h2', {}, [h('span', { text: 'Who has access' }), h('span', { class: 'count', text: list.length + ' of 15' })]),
        h('div', { class: 'rows' }, list.length ? list.map(function (a) {
          var mine = a.k === window.TETHER_ME || a.k === 'me';
          return h('div', { class: 'row person' }, [
            h('span', { class: 'label' }, [h('span', { text: a.n }), h('small', { text: RANKS[a.r] })]),
            mine ? h('span', { class: 'you', text: 'you' }) : h('button', { class: 'ghost small', text: 'Remove', on: { click: function () { set(a.k, 0, a.n); } } })
          ]);
        }) : [h('p', { class: 'empty', text: 'Loading' })])
      ]),
      h('div', { class: 'group' }, [
        h('h2', {}, [h('span', { text: 'Nearby' })]),
        h('div', { class: 'rows' }, near.length ? near.map(function (a) {
          return h('div', { class: 'row person' }, [
            h('span', { class: 'label' }, [h('span', { text: a.n })]),
            h('span', { class: 'btns' }, [
              h('button', { class: 'ghost small', text: 'Owner', on: { click: function () { set(a.k, 3, a.n); } } }),
              h('button', { class: 'ghost small', text: 'Trusted', on: { click: function () { set(a.k, 2, a.n); } } }),
              h('button', { class: 'ghost small', text: 'Block', on: { click: function () { set(a.k, -1, a.n); } } })
            ])
          ]);
        }) : [h('p', { class: 'empty', text: 'Nobody else within 30 meters.' })])
      ])
    ]);
  }

  render();
  transport.start();
})();
