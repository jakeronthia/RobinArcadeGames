/* ROBIN Arcade: sends each finished run to the weekly leaderboard.
   Every game calls RobinRanked.start(game, ranked) when a run begins and
   RobinRanked.end(game, value, ranked) when it ends. Works inside the site's
   game page and when a phone opens the game on its own. */
(function () {
  var API = '../api/';
  var runs = {};
  function session() { try { return JSON.parse(localStorage.getItem('arcade-session') || 'null'); } catch (e) { return null; } }
  function call(path, body) {
    var s = session(); if (!s) return Promise.reject(new Error('signed-out'));
    return fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s.token }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (r.status === 401) { try { localStorage.removeItem('arcade-session'); } catch (e) {} } if (!r.ok) throw new Error(j.error || 'error'); return j; }); });
  }
  function toast(html, ms) {
    var t = document.createElement('div');
    t.setAttribute('role', 'status');
    t.style.cssText = 'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 64px);transform:translateX(-50%);z-index:99999;background:#1a1433;color:#fff;border:2px solid #ffc93c;border-radius:14px;padding:10px 16px;font:800 14px/1.35 Nunito,Fredoka,system-ui,sans-serif;text-align:center;box-shadow:0 4px 0 #1d1038;max-width:min(90vw,420px);pointer-events:none;transition:opacity .4s';
    t.innerHTML = html; document.body.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 450); }, ms || 3600);
  }
  function notify(msg) { try { if (parent !== window) parent.postMessage(Object.assign({ type: 'robin-ranked' }, msg), location.origin); } catch (e) {} }
  var warned = false;
  window.RobinRanked = {
    start: function (game, ranked) {
      runs[game] = null;
      if (ranked === false || !session()) return;
      runs[game] = call('run', { game: game }).then(function (j) { return j.run; }).catch(function () { return null; });
    },
    end: function (game, value, ranked) {
      value = Math.max(0, Math.floor(value || 0));
      if (ranked === false) return;
      if (!session()) {
        if (!warned && value > 0) { warned = true; toast('Connect your NEAR wallet in <b>Profile</b> to enter the weekly leaderboard.', 4200); }
        return;
      }
      var p = runs[game] || Promise.resolve(null); runs[game] = null;
      p.then(function (run) { return call('score', { game: game, value: value, run: run }); })
        .then(function (j) {
          if (j.saved) toast('Weekly leaderboard: <b style="color:#ffc93c">#' + j.rank + '</b> · best ' + Number(j.best).toLocaleString('en'));
          notify({ game: game, rank: j.rank, best: j.best });
        })
        .catch(function (e) { if (e.message !== 'signed-out' && value > 0) toast('Score not counted: ' + e.message); });
    }
  };
})();
