(function(){
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- year ---------- */
  var yearEl = document.getElementById("year");
  if(yearEl){ yearEl.textContent = new Date().getFullYear(); }

  /* ---------- mobile menu ---------- */
  var menu = document.getElementById("mobileMenu");
  var openBtn = document.getElementById("menuOpen");
  var closeBtn = document.getElementById("menuClose");
  if(!menu || !openBtn || !closeBtn){ menu = null; }

  function setMenu(open){
    if(!menu) return;
    menu.dataset.open = String(open);
    openBtn.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if(open){ menu.scrollTop = 0; closeBtn.focus(); } else { openBtn.focus(); }
  }
  if(menu){
  openBtn.addEventListener("click", function(){ setMenu(true); });
  closeBtn.addEventListener("click", function(){ setMenu(false); });
  menu.addEventListener("click", function(e){
    if(e.target.tagName === "A"){ setMenu(false); }
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && menu.dataset.open === "true"){ setMenu(false); }
  });
  /* keep focus inside the open menu */
  menu.addEventListener("keydown", function(e){
    if(e.key !== "Tab" || menu.dataset.open !== "true") return;
    var f = menu.querySelectorAll("a[href], button");
    if(!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
  }

  /* ---------- waitlist forms ---------- */
  /* The optional feedback dialog (index.html). Browsers without <dialog>
     support simply never show its invitation. */
  var fb = document.getElementById("feedback");
  if(fb && typeof fb.showModal !== "function"){ fb = null; }

  document.querySelectorAll("form[data-waitlist]").forEach(function(form){
    var input  = form.querySelector('input[type="email"]');
    var btn    = form.querySelector('button[type="submit"]');
    var label  = btn.querySelector("[data-label]");
    var status = form.querySelector(".form-status");
    var idle   = label.textContent;

    function say(msg, tone){
      status.textContent = msg;
      if(tone){ status.dataset.tone = tone; } else { delete status.dataset.tone; }
    }
    function busy(on){
      btn.disabled = on;
      label.textContent = on ? "Sending" : idle;
      var sp = btn.querySelector(".spinner");
      if(on && !sp){
        sp = document.createElement("span");
        sp.className = "spinner";
        sp.setAttribute("aria-hidden","true");
        btn.insertBefore(sp, label);
      } else if(!on && sp){ sp.remove(); }
    }

    input.addEventListener("input", function(){
      if(status.textContent){ say(""); }
      input.setAttribute("aria-invalid","false");
    });

    form.addEventListener("submit", function(e){
      var action = form.getAttribute("action") || "";

      /* Not wired up: say so plainly instead of failing silently. */
      if(!/^https?:\/\//.test(action)){
        e.preventDefault();
        say("This form is not connected yet. See EDIT-ME FORMS in index.html.", "err");
        return;
      }
      if(!input.value || !input.checkValidity()){
        e.preventDefault();
        input.setAttribute("aria-invalid","true");
        say("Please enter a valid email address.", "err");
        input.focus();
        return;
      }
      /* fetch submit so the page never navigates away */
      e.preventDefault();
      busy(true);
      say("");
      fetch(action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      }).then(function(res){
        if(res.ok){
          form.querySelector(".field-row").style.display = "none";
          var note = form.querySelector(".form-note");
          if(note){ note.style.display = "none"; }
          say("You are on the list. We will email you once, when the founding batch opens.", "ok");
          var invite = form.querySelector(".fb-invite");
          if(invite && fb){
            fb.querySelector('input[name="email"]').value = input.value.trim();
            invite.hidden = false;
          }
        } else {
          return res.json().then(function(d){
            throw new Error((d.errors && d.errors[0] && d.errors[0].message) || "Something went wrong.");
          });
        }
      }).catch(function(err){
        busy(false);
        say(err.message + " Please try again, or email us directly.", "err");
      });
    });
  });

  /* ---------- business floor plan ----------
     The dashboard's floor plan view, rebuilt for business.html. Six Canaries
     sit where they sit in the demo, and a slider moves through the working
     day.

     The readings are simulated, and simulated the way a building behaves
     rather than at random: carbon dioxide climbs while people are in a room
     and falls back towards outdoor air when they leave, as fast as the
     ventilation manages. Each room's curve is solved once from its own hours,
     then scaled so 3pm lands exactly on the number quoted beside the plan.
     The other three readings follow the same occupancy shape between a
     morning floor and that same 3pm figure, which is why they all ease up
     through the afternoon together. */
  var plan = document.querySelector("[data-plan]");
  if(plan){
    /* x and y are percentages of the plan image, from the demo. `busy` are the
       hours each room holds people; `at3` is its 3pm reading per channel. */
    var ROOMS = [
      { name:"Lena's Canary", x:8,  y:29, busy:[[9,12],[13,17]],      at3:{ co2:681,  pm25:5.2,  temp:21.6, rh:37 } },
      { name:"Rooster",       x:82, y:16, busy:[[8.5,12],[13,16]],    at3:{ co2:983,  pm25:7.4,  temp:23.8, rh:40 } },
      { name:"Tom's Canary",  x:45, y:47, busy:[[9,12.5],[13,17.5]],  at3:{ co2:1149, pm25:9.6,  temp:22.9, rh:44 } },
      { name:"Renée's Canary",x:59, y:57, busy:[[9,12.5],[13,17.5]],  at3:{ co2:1350, pm25:11.2, temp:23.4, rh:46 } },
      { name:"Small Room",    x:40, y:86, busy:[[10,11],[14,15.5]],   at3:{ co2:1349, pm25:8.1,  temp:23.1, rh:45 } },
      { name:"Conference",    x:76, y:87, busy:[[9.5,10.5],[13.5,16]],at3:{ co2:1750, pm25:12.4, temp:24.2, rh:48 } }
    ];
    /* floor: the reading an empty room settles at overnight. ok/warn: where
       the colour changes, from the WHO guideline for PM2.5 and the usual
       comfort bands for the rest. top: the reading that earns the widest
       ripple, past the red threshold so the worst room still stands out
       from a merely bad one. */
    var CHANNELS = {
      co2:  { unit:"parts per million", short:"ppm",     dp:0, floor:430,  ok:800,  warn:1200, top:1900 },
      pm25: { unit:"micrograms per cubic metre", short:"µg/m³", dp:1, floor:3.4, ok:8, warn:15, top:22 },
      temp: { unit:"degrees Celsius", short:"°C",   dp:1, floor:20.4, ok:24.5, warn:26, top:27 },
      rh:   { unit:"percent relative humidity", short:"%", dp:0, floor:33, ok:60,   warn:70, top:75 }
    };
    var OPEN = 8, CLOSE = 18, STEP = 1 / 12;   /* five-minute steps */
    var TAU = 0.85;                            /* hours to clear a room */
    var RIPPLE_COUNT = 10, RIPPLE_GAP = 0.6;   /* rings per sensor, seconds apart */
    var DAY_SECONDS = 40;                      /* a working day, played through */

    /* Occupancy in, ventilation out, sampled every five minutes. The result is
       normalised to its own 3pm value, so it is a shape, not a unit. */
    function shape(room){
      var out = [], level = 0;
      for(var t = OPEN; t <= CLOSE + 1e-9; t += STEP){
        var busy = room.busy.some(function(span){ return t >= span[0] && t < span[1]; });
        level += ((busy ? 1 : 0) - level / TAU) * STEP;
        out.push(Math.max(level, 0));
      }
      var at3 = out[Math.round((15 - OPEN) / STEP)] || 1;
      return out.map(function(v){ return v / at3; });
    }
    ROOMS.forEach(function(room){ room.shape = shape(room); });

    /* Rooms do not all settle at exactly the same number overnight, so each
       one keeps a small standing offset from the floor. */
    ROOMS.forEach(function(room, i){ room.quiet = 1 + (i - 2.5) * 0.012; });

    function reading(room, channel, hour){
      var c = CHANNELS[channel];
      var i = (hour - OPEN) / STEP;
      var lo = room.shape[Math.floor(i)], hi = room.shape[Math.ceil(i)];
      var s = lo + (hi - lo) * (i - Math.floor(i));
      var quiet = c.floor * room.quiet;
      return quiet + (room.at3[channel] - quiet) * s;
    }

    var stage    = plan.querySelector(".plan-stage");
    var controls = plan.querySelector(".plan-controls");
    var slider   = plan.querySelector("[data-plan-time]");
    var clockEl  = plan.querySelector("[data-plan-clock]");
    var unitEl   = plan.querySelector("[data-plan-unit]");
    var channel  = "co2";

    var points = ROOMS.map(function(room){
      var el = document.createElement("span");
      el.className = "plan-pt";
      el.style.left = room.x + "%";
      el.style.top  = room.y + "%";
      /* The demo's ripple: a stack of identical circles on one long loop,
         each starting a little after the last, so rings leave the sensor
         continuously. Ten circles at 0.6s apart fill a 6s animation. */
      var rings = "";
      for(var i = 0; i < RIPPLE_COUNT; i++){
        rings += '<span class="plan-ring" style="animation-delay:' + (i * RIPPLE_GAP) + 's"></span>';
      }
      el.innerHTML = '<span class="plan-ripple" aria-hidden="true">' + rings + '</span>'
                   + '<span class="plan-val" aria-hidden="true"></span>'
                   + '<span class="visually-hidden"></span>';
      stage.appendChild(el);
      return { el:el, room:room, val:el.querySelector(".plan-val"),
               say:el.querySelector(".visually-hidden"), ripple:el.querySelector(".plan-ripple") };
    });

    function clock(hour){
      var h = Math.floor(hour), m = Math.round((hour - h) * 60);
      var suffix = h < 12 ? "am" : "pm";
      return ((h % 12) || 12) + ":" + (m < 10 ? "0" : "") + m + " " + suffix;
    }

    function draw(){
      var hour = parseFloat(slider.value);
      var c = CHANNELS[channel];
      clockEl.textContent = clock(hour);
      /* say what the colours mean, in the channel's own units */
      /* "800 ppm" but "60%" and "26°C": symbols sit against the number */
      var scale = function(v){
        return v.toLocaleString("en") + (/^[%°]/.test(c.short) ? "" : " ") + c.short;
      };
      unitEl.textContent = c.unit + ". Green to " + scale(c.ok)
                         + ", red past " + scale(c.warn) + ".";
      points.forEach(function(p){
        var v = reading(p.room, channel, hour);
        var shown = v.toFixed(c.dp);
        p.val.textContent = shown;
        p.say.textContent = p.room.name + ": " + shown + " " + c.short;
        p.el.title = p.room.name;
        p.el.dataset.level = v >= c.warn ? "high" : v >= c.ok ? "warn" : "ok";
        /* the ripple grows with the reading, so the worst room in the office
           is the one you notice from across the page */
        var span = Math.min(Math.max((v - c.floor) / (c.top - c.floor), 0), 1);
        p.ripple.style.setProperty("--ripple", (3.4 + span * 7.4).toFixed(2) + "em");
      });
    }

    plan.querySelectorAll(".plan-chip").forEach(function(chip){
      chip.addEventListener("click", function(){
        channel = chip.dataset.channel;
        plan.querySelectorAll(".plan-chip").forEach(function(other){
          other.setAttribute("aria-pressed", String(other === chip));
        });
        draw();
      });
    });
    slider.addEventListener("input", function(){
      play(false);           /* taking the slider means taking over */
      draw();
    });

    /* The day plays itself, so the section shows its argument to someone who
       only scrolls past. It stops when it is off screen, when the reader
       takes the slider, and for anyone who asks their system for less
       animation. */
    var playBtn  = plan.querySelector("[data-plan-play]");
    var iconPlay = playBtn.querySelector("[data-icon-play]");
    var iconStop = playBtn.querySelector("[data-icon-pause]");
    var still    = window.matchMedia("(prefers-reduced-motion: reduce)");
    var wanted   = !still.matches;   /* what the reader wants */
    var onScreen = true;
    var timer    = null;
    var last     = 0;

    /* A timer rather than requestAnimationFrame: the clock decides how far
       the day moves, so a browser that throttles callbacks slows the picture
       down instead of stopping it. */
    function tick(){
      var now = Date.now();
      var hour = parseFloat(slider.value) + (now - last) / 1000 * (CLOSE - OPEN) / DAY_SECONDS;
      last = now;
      slider.value = hour > CLOSE ? OPEN : hour;
      draw();
    }
    function play(on){
      wanted = on;
      playBtn.setAttribute("aria-label", on ? "Pause the day" : "Play the day");
      /* setAttribute, not .hidden: the hidden property belongs to HTML
         elements, and these two icons are SVG. */
      iconPlay.toggleAttribute("hidden", on);
      iconStop.toggleAttribute("hidden", !on);
      if(on && onScreen && !timer){
        last = Date.now();
        timer = setInterval(tick, 100);
      } else if((!on || !onScreen) && timer){
        clearInterval(timer);
        timer = null;
      }
    }
    playBtn.addEventListener("click", function(){ play(!wanted); });

    /* Off screen it should not tick, but a browser without
       IntersectionObserver simply keeps playing. */
    if(window.IntersectionObserver){
      new IntersectionObserver(function(entries){
        onScreen = entries[entries.length - 1].isIntersecting;
        play(wanted);
      }, { threshold:0, rootMargin:"0px 0px -15% 0px" }).observe(plan);
    }

    controls.hidden = false;
    draw();
    play(wanted);
  }

  /* ---------- feedback dialog ----------
     Opened from the invitation under a successful signup. The signup's
     email rides along in a hidden field so the answers can be matched to
     it. Closing the dialog keeps what was typed; sending replaces the
     invitation with a thank-you and closes it. */
  if(fb){
    var fbForm   = fb.querySelector("form");
    var fbBtn    = fbForm.querySelector('button[type="submit"]');
    var fbLabel  = fbBtn.querySelector("[data-label]");
    var fbStatus = fbForm.querySelector(".form-status");
    var fbIdle   = fbLabel.textContent;
    var fbSay = function(msg, tone){
      fbStatus.textContent = msg;
      if(tone){ fbStatus.dataset.tone = tone; } else { delete fbStatus.dataset.tone; }
    };

    document.addEventListener("click", function(e){
      if(e.target.closest && e.target.closest("[data-open-feedback]")){ fbSay(""); fb.showModal(); }
      if(e.target.closest && e.target.closest("[data-close-feedback]")){ fb.close(); }
    });
    /* A click on the dimmed backdrop lands on the <dialog> itself. Checking
       where the press started stops a text selection dragged out of a
       field from closing it. */
    var fbPressedBackdrop = false;
    fb.addEventListener("pointerdown", function(e){ fbPressedBackdrop = e.target === fb; });
    fb.addEventListener("click", function(e){ if(fbPressedBackdrop && e.target === fb){ fb.close(); } });

    /* Typing an "Other" answer ticks its box. */
    fbForm.addEventListener("input", function(e){
      var other = e.target.type === "text" && e.target.closest(".fb-other");
      if(other && e.target.value.trim()){
        other.querySelector('input[type="radio"], input[type="checkbox"]').checked = true;
      }
    });

    fbForm.addEventListener("submit", function(e){
      e.preventDefault();
      fbBtn.disabled = true;
      fbLabel.textContent = "Sending";
      fbSay("");
      fetch(fbForm.getAttribute("action"), {
        method: "POST",
        body: new FormData(fbForm),
        headers: { Accept: "application/json" }
      }).then(function(res){
        if(res.ok){
          fb.close();
          document.querySelectorAll(".fb-invite:not([hidden])").forEach(function(invite){
            var btn = invite.querySelector("[data-open-feedback]");
            if(btn){ btn.remove(); }
            var p = invite.querySelector("p");
            p.textContent = "Thank you. Your answers are in, and we will remember you when we pack your box.";
            p.setAttribute("tabindex", "-1");
            p.focus();
          });
        } else {
          return res.json().then(function(d){
            throw new Error((d.errors && d.errors[0] && d.errors[0].message) || "Something went wrong.");
          });
        }
      }).catch(function(err){
        fbSay(err.message + " Please try again.", "err");
      }).then(function(){
        fbBtn.disabled = false;
        fbLabel.textContent = fbIdle;
      });
    });
  }

  /* ---------- waitlist attribution ----------
     The bottom form's hidden `source` field records how a signup reached
     it, so the signup export shows which links earn their place. Values are
     page-element: "index-header", "science-bar", "history-footer".

     Links on this page carry data-source and set the field on click.
     Links on the other pages cannot reach this form, so they carry ?from=
     and it is read here on arrival, then dropped from the address bar so a
     shared URL does not pass on someone else's attribution. The same
     parameter works for outside campaigns: index.html?from=instagram#waitlist

     Last click wins. With no click and no parameter the field keeps its
     default, "index-scroll", or "direct-link" when the page was opened
     straight onto #waitlist. ---------- */
  var srcField = document.querySelector('#waitlist input[name="source"]');
  if(srcField){
    var tidySource = function(v){
      return String(v || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    };
    var fromParam = "";
    try{ fromParam = tidySource(new URLSearchParams(location.search).get("from")); }catch(e){}
    if(fromParam){
      srcField.value = fromParam;
      try{
        var cleanUrl = new URL(location.href);
        cleanUrl.searchParams.delete("from");
        history.replaceState(history.state, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      }catch(e){}
    } else if(location.hash === "#waitlist"){
      srcField.value = "direct-link";
    }
    document.addEventListener("click", function(e){
      var a = e.target.closest ? e.target.closest("a[data-source]") : null;
      if(a){ srcField.value = tidySource(a.getAttribute("data-source")); }
    });
  }

  /* ---------- carousels ---------- */
  document.querySelectorAll("[data-rail]").forEach(function(rail){
    var prev = document.querySelector('[data-rail-prev="' + rail.id + '"]');
    var next = document.querySelector('[data-rail-next="' + rail.id + '"]');
    if(!prev || !next) return;

    function step(){
      var item = rail.firstElementChild;
      if(!item) return 320;
      var gap = parseFloat(getComputedStyle(rail).columnGap) || 16;
      return item.getBoundingClientRect().width + gap;
    }
    function syncNav(){
      var first = rail.firstElementChild, last = rail.lastElementChild;
      if(!first || !last) return;
      var cs = getComputedStyle(rail);
      var padL = parseFloat(cs.paddingLeft) || 0;
      var padR = parseFloat(cs.paddingRight) || 0;
      var rr = rail.getBoundingClientRect();
      var atStart = first.getBoundingClientRect().left >= rr.left + padL - 2;
      var atEnd   = last.getBoundingClientRect().right <= rr.right - padR + 2;
      prev.disabled = atStart;
      next.disabled = atEnd;
      /* everything already fits: hide the controls rather than show two
         permanently dead buttons */
      prev.parentNode.style.visibility = (atStart && atEnd) ? "hidden" : "";
    }
    function go(dir){
      rail.scrollBy({ left: dir * step(), behavior: reduce.matches ? "auto" : "smooth" });
    }
    prev.addEventListener("click", function(){ go(-1); });
    next.addEventListener("click", function(){ go(1); });
    rail.addEventListener("scroll", function(){ window.requestAnimationFrame(syncNav); }, { passive:true });
    window.addEventListener("resize", syncNav, { passive:true });
    syncNav();
  });

  /* ---------- measurement marquee ----------
     One row at every width. If the seven items fit, they are centred and left
     alone: there is nothing to scroll past, so scrolling would be noise. If
     they would overflow, the set is cloned until the track is at least twice
     the viewport, so a full set is always waiting off-screen, and the track
     travels exactly one set width. That is what makes the wrap invisible.
     Clones are aria-hidden, so the list is announced once.               */
  document.querySelectorAll("[data-marquee]").forEach(function(viewport){
    var track = viewport.querySelector(".specs-track");
    if(!track) return;

    var originals = [].slice.call(track.children);
    if(!originals.length) return;
    var SPEED = 45;                     /* px per second */
    var clones = [];

    function measureSet(){
      var w = 0;
      originals.forEach(function(li){ w += li.getBoundingClientRect().width; });
      return w;
    }

    function build(){
      lastWidth = viewport.clientWidth;
      clones.forEach(function(c){ c.remove(); });
      clones = [];
      track.classList.remove("is-running");
      track.style.removeProperty("--marquee-distance");
      track.style.removeProperty("--marquee-duration");

      var setWidth = measureSet();
      if(!setWidth) return;

      /* fits: centre the row, no clones, no animation */
      if(setWidth <= viewport.clientWidth){
        viewport.classList.remove("is-marquee");
        track.classList.add("is-static");
        return;
      }

      /* overflows: mask the edges either way, so the cut reads as a fade */
      track.classList.remove("is-static");
      viewport.classList.add("is-marquee");

      /* reduced motion: leave it as a row the reader scrolls by hand */
      if(reduce.matches) return;

      var needed = Math.max(2, Math.ceil((viewport.clientWidth * 2) / setWidth) + 1);
      for(var copy = 1; copy < needed; copy++){
        originals.forEach(function(li){
          var c = li.cloneNode(true);
          c.setAttribute("aria-hidden", "true");
          track.appendChild(c);
          clones.push(c);
        });
      }
      track.style.setProperty("--marquee-distance", setWidth + "px");
      track.style.setProperty("--marquee-duration", (setWidth / SPEED) + "s");
      track.classList.add("is-running");
    }

    var t, lastWidth = -1;
    /* Only width matters here: the clone count, the distance and the duration
       are all derived from widths. Height must be ignored, because mobile
       browsers fire resize every time the URL bar slides in or out during a
       scroll. Rebuilding on that re-adds .is-running, which restarts the
       animation at translateX(0), and the row visibly snaps back to the start
       the moment the reader lifts their finger. */
    window.addEventListener("resize", function(){
      if(Math.abs(viewport.clientWidth - lastWidth) <= 1) return;
      window.clearTimeout(t);
      t = window.setTimeout(build, 200);
    }, { passive:true });

    if(reduce.addEventListener){ reduce.addEventListener("change", build); }

    /* fonts change the measured width, so rebuild once they have loaded */
    if(document.fonts && document.fonts.ready){ document.fonts.ready.then(build); }
    build();
  });

  /* ---------- annotated 3D model ----------
     model-viewer is ~300KB of script and the glb is 1.4MB, so neither is
     fetched until the stage is close to the viewport. Once it is up, every
     camera change re-reads where each anchor landed on screen and redraws its
     leader line; the labels themselves never move.                      */
  (function(){
    var stage = document.querySelector("[data-model-stage]");
    if(!stage) return;
    var mv = stage.querySelector("model-viewer");
    var svg = stage.querySelector(".model-lines");
    var labels = [].slice.call(stage.querySelectorAll(".model-label"));
    if(!mv || !svg || !labels.length) return;

    var SRC = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.3.1/model-viewer.min.js";
    var NS = "http://www.w3.org/2000/svg";

    /* one line per label, paired by the slot it points at */
    var pairs = labels.map(function(label){
      var line = document.createElementNS(NS, "line");
      svg.appendChild(line);
      return { label:label, line:line,
               anchor:mv.querySelector('[slot="' + label.dataset.for + '"]') };
    }).filter(function(p){ return p.anchor; });

    /* Rotation is completely free: yaw and pitch both, all the way round.
       Nothing can be cropped anyway, because the camera is placed so the
       model's bounding sphere fits the frame whichever way it is turned.

       The device is 110 x 67 x 18mm, so its diagonal is 130mm and the sphere
       that contains it has a 65mm radius. A sphere of radius R at distance r
       subtends 2*asin(R/r), so asking it to fill at most 85% of the narrower
       field of view fixes r. The vertical field of view is 30 degrees and the
       horizontal one follows the box aspect, which is why a wide desktop
       stage can hold the camera closer than a tall phone one: on a phone the
       horizontal is the tighter of the two.

       Zoom stays disabled, so this radius is also pinned as the whole of the
       allowed orbit range.                                                */
    var SPHERE = 0.065;                       /* metres */
    var VFOV = 30 * Math.PI / 180;
    var FILL = 0.85;                          /* leave 15% as breathing room */
    var lastRadius = 0;

    function frame(){
      var w = mv.clientWidth, h = mv.clientHeight;
      if(!w || !h) return;
      var hfov = 2 * Math.atan(Math.tan(VFOV / 2) * (w / h));
      var half = Math.min(VFOV, hfov) * FILL / 2;
      var radius = SPHERE / Math.sin(half);
      if(Math.abs(radius - lastRadius) < 0.002) return;
      lastRadius = radius;
      var r = radius.toFixed(3) + "m";
      mv.setAttribute("min-camera-orbit", "auto auto " + r);
      mv.setAttribute("max-camera-orbit", "auto auto " + r);
      /* Pinning the range does not move a camera already inside it, so write
         the radius through too. Only once loaded: before that getCameraOrbit
         reports zeroes, and writing those back points the camera at the sky. */
      if(!mv.loaded) return;
      var o = mv.getCameraOrbit();
      mv.cameraOrbit = o.theta + "rad " + o.phi + "rad " + r;
    }

    var queued = false;
    function draw(){
      queued = false;
      var sr = stage.getBoundingClientRect();
      if(!sr.width) return;
      pairs.forEach(function(p){
        /* model-viewer drops data-visible when the point faces away */
        var on = p.anchor.hasAttribute("data-visible");
        p.label.classList.toggle("is-on", on);
        p.line.classList.toggle("is-on", on);
        if(!on) return;
        var ar = p.anchor.getBoundingClientRect();
        var lr = p.label.getBoundingClientRect();
        var toLeft = p.label.classList.contains("model-label--left");
        /* the line leaves the label on the side facing the device, with a
           small gap so it never touches the text */
        var x1 = (toLeft ? lr.right + 8 : lr.left - 8) - sr.left;
        var y1 = lr.top + lr.height / 2 - sr.top;
        p.line.setAttribute("x1", x1);
        p.line.setAttribute("y1", y1);
        p.line.setAttribute("x2", ar.left + ar.width / 2 - sr.left);
        p.line.setAttribute("y2", ar.top + ar.height / 2 - sr.top);
      });
    }
    function schedule(){
      if(queued) return;
      queued = true;
      window.requestAnimationFrame(draw);
    }

    function wire(){
      mv.addEventListener("camera-change", schedule, { passive:true });
      mv.addEventListener("load", function(){
        stage.classList.add("is-ready");
        frame();
        schedule();
      });
      /* The hint goes only once the model has actually been turned, not on a
         stray tap or a scroll that grazes it. A reader who pokes it without
         rotating still needs telling. model-viewer marks camera changes it
         caused itself as "none", so user-interaction is the real thing, and
         zoom and pan are both disabled, which leaves rotation. */
      mv.addEventListener("camera-change", function(e){
        if(e.detail && e.detail.source === "user-interaction"){
          stage.classList.add("is-touched");
        }
      }, { passive:true });
      function onResize(){ frame(); schedule(); }
      if("ResizeObserver" in window){ new ResizeObserver(onResize).observe(stage); }
      else { window.addEventListener("resize", onResize, { passive:true }); }
      onResize();
    }

    var started = false;
    function start(){
      if(started) return;
      started = true;
      var tag = document.createElement("script");
      tag.type = "module";
      tag.src = SRC;
      document.head.appendChild(tag);
      if(window.customElements && customElements.whenDefined){
        customElements.whenDefined("model-viewer").then(wire);
      } else {
        tag.addEventListener("load", wire);
      }
    }

    /* Start when the stage comes within a screen or two. IntersectionObserver
       is the good path, but it is not the only trigger: a missed observer
       would leave the model permanently blank, so a cheap geometry check on
       scroll and resize backs it up. */
    function near(){
      var r = stage.getBoundingClientRect();
      return r.top < window.innerHeight * 2 && r.bottom > -window.innerHeight;
    }
    function maybeStart(){
      if(started) return;
      if(near()){
        start();
        window.removeEventListener("scroll", maybeStart);
        window.removeEventListener("resize", maybeStart);
      }
    }
    if("IntersectionObserver" in window){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if(e.isIntersecting){ start(); io.disconnect(); } });
      }, { rootMargin:"600px 0px" });
      io.observe(stage);
    }
    window.addEventListener("scroll", maybeStart, { passive:true });
    window.addEventListener("resize", maybeStart, { passive:true });
    maybeStart();
  })();

  /* ---------- email addresses ----------
     The address is stored reversed so no address-shaped string sits in the
     markup for a harvester to regex out, and is assembled here into a real
     mailto link. Anyone running a scraper with a JS engine will still get it;
     this only stops the naive ones. Without JS the readable "sales at canary
     dot earth" text stays, which a person can still use.              */
  document.querySelectorAll("[data-mail]").forEach(function(el){
    var parts = el.getAttribute("data-mail").split("").reverse().join("").split(":");
    if(parts.length !== 2) return;
    var addr = parts[0] + String.fromCharCode(64) + parts[1];
    var a = document.createElement("a");
    a.href = "mailto:" + addr;
    a.textContent = addr;
    a.className = el.className;
    el.parentNode.replaceChild(a, el);
  });

  /* ---------- device readout carousel ----------
     The device is static; the readouts slide behind its window. Every
     transition writes its own final state, so hammering the buttons can
     never leave a slide stranded mid-animation.                        */
  document.querySelectorAll("[data-carousel]").forEach(function(root){
    var slides = [].slice.call(root.querySelectorAll("[data-slide]"));
    var caps   = [].slice.call(root.querySelectorAll("[data-cap]"));
    var dots   = [].slice.call(root.querySelectorAll("[data-dot]"));
    var prev   = root.querySelector("[data-prev]");
    var next   = root.querySelector("[data-next]");
    var play   = root.querySelector("[data-play]");
    var pLabel = root.querySelector("[data-play-label]");
    var iPause = root.querySelector("[data-icon-pause]");
    var iPlay  = root.querySelector("[data-icon-play]");
    var status = root.querySelector("[data-status]");
    var count  = root.querySelector("[data-count]");
    var n = slides.length;
    if(!n) return;

    var active = 0, timer = null, userPaused = false, onScreen = false;
    var DELAY = 4500, OFFSET = 7;   /* % the readouts travel */

    function park(el, pct){
      el.style.transition = "none";
      el.style.transform  = "translateX(" + pct + "%)";
      el.style.opacity    = "0";
      void el.offsetHeight;          /* flush, so the next change animates */
      el.style.transition = "";
    }
    function show(i, dir, announce){
      i = ((i % n) + n) % n;
      if(i === active && slides[i].hasAttribute("data-active")) return;
      var incoming = slides[i], outgoing = slides[active];

      if(outgoing && outgoing !== incoming){
        outgoing.removeAttribute("data-active");
        outgoing.style.transform = "translateX(" + (dir > 0 ? -OFFSET : OFFSET) + "%)";
        outgoing.style.opacity = "0";
        outgoing.style.zIndex = "1";
        outgoing.setAttribute("aria-hidden", "true");
      }
      park(incoming, dir > 0 ? OFFSET : -OFFSET);
      incoming.setAttribute("data-active", "");
      incoming.style.transform = "translateX(0)";
      incoming.style.opacity = "1";
      incoming.style.zIndex = "2";
      incoming.setAttribute("aria-hidden", "false");

      active = i;
      caps.forEach(function(c, k){
        if(k === active){ c.setAttribute("data-active",""); } else { c.removeAttribute("data-active"); }
      });
      dots.forEach(function(d, k){ d.setAttribute("aria-current", k === active ? "true" : "false"); });
      if(count){ count.textContent = (active + 1) + " / " + n; }
      if(announce && status){
        var tag = caps[active].querySelector(".sensor-tag");
        status.textContent = (active + 1) + " of " + n + ": " + (tag ? tag.textContent : "");
      }
    }
    function stop(){ if(timer){ window.clearInterval(timer); timer = null; } }
    function start(){
      stop();
      if(userPaused || reduce.matches || !onScreen) return;
      timer = window.setInterval(function(){ show(active + 1, 1, false); }, DELAY);
    }
    function setPaused(paused){
      userPaused = paused;
      play.setAttribute("aria-pressed", String(paused));
      pLabel.textContent = paused ? "Play the readout carousel" : "Pause the readout carousel";
      iPause.style.display = paused ? "none" : "";
      iPlay.style.display  = paused ? "" : "none";
      if(paused){ stop(); } else { start(); }
    }

    prev.addEventListener("click", function(){ show(active - 1, -1, true); start(); });
    next.addEventListener("click", function(){ show(active + 1,  1, true); start(); });
    dots.forEach(function(d, k){
      d.addEventListener("click", function(){
        show(k, k > active ? 1 : -1, true); start();
      });
    });
    play.addEventListener("click", function(){ setPaused(!userPaused); });

    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    root.addEventListener("focusin", stop);
    root.addEventListener("focusout", function(e){
      if(!root.contains(e.relatedTarget)) start();
    });
    root.addEventListener("keydown", function(e){
      if(e.key === "ArrowLeft"){ e.preventDefault(); show(active - 1, -1, true); }
      else if(e.key === "ArrowRight"){ e.preventDefault(); show(active + 1, 1, true); }
    });

    /* swipe across the device */
    var dragX = null;
    root.addEventListener("pointerdown", function(e){ dragX = e.clientX; });
    root.addEventListener("pointerup", function(e){
      if(dragX === null) return;
      var dx = e.clientX - dragX; dragX = null;
      if(Math.abs(dx) > 40){ show(active + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1, true); start(); }
    });
    root.addEventListener("pointercancel", function(){ dragX = null; });

    if("IntersectionObserver" in window){
      new IntersectionObserver(function(es){
        onScreen = es[0].isIntersecting;
        if(onScreen){ start(); } else { stop(); }
      }, { threshold: 0.25 }).observe(root);
    } else { onScreen = true; }

    if(reduce.addEventListener){
      reduce.addEventListener("change", function(){
        if(reduce.matches){ setPaused(true); } else { start(); }
      });
    }

    slides.forEach(function(el, k){
      el.setAttribute("aria-hidden", k === 0 ? "false" : "true");
    });
    /* show() short-circuits for the slide that is already active, so seed
       the counter here rather than leaving it blank until the first change */
    if(count){ count.textContent = "1 / " + n; }
    if(reduce.matches){ setPaused(true); } else { start(); }
  });

  /* ---------- scroll reveal ---------- */
  var targets = document.querySelectorAll(".reveal");
  if(reduce.matches || !("IntersectionObserver" in window)){
    targets.forEach(function(el){ el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    targets.forEach(function(el){ io.observe(el); });
    window.setTimeout(function(){
      targets.forEach(function(el){
        var r = el.getBoundingClientRect();
        if(r.top < window.innerHeight && r.bottom > 0){ el.classList.add("in"); }
      });
    }, 1200);
  }

  /* ---------- palette switcher (test harness) ----------
     Scaffolding for judging alternate palettes on the real page rather
     than on swatches. It is gated so it cannot reach a visitor:
     localhost, a private LAN address, file://, or an explicit ?themes.

     themes.css is injected here rather than linked from the four HTML
     pages, so production never requests it and removing the whole
     feature is this block plus one file. ---------- */
  var host = location.hostname;
  /* A phone reaches the dev server on the machine's LAN address, not on
     localhost, so the gate has to admit private ranges or the switcher
     would be missing on exactly the screens worth checking colour on.
     None of these ranges are routable from the internet. */
  var LAN = /^(localhost|127\.|\[?::1\]?$|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
  var themesOn = LAN.test(host) || /\.local$/.test(host)
    || location.protocol === "file:"
    || /[?&]themes\b/.test(location.search);

  if(themesOn){
    var PALETTES = [
      ["", "Botanical (live)"],
      ["solar", "Solar"],
      ["cyanotype", "Cyanotype"],
      ["graphite", "Graphite"],
      ["ember", "Ember"]
    ];

    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "assets/themes.css";
    document.head.appendChild(link);

    /* Read before the sheet lands so each choice is applied on the first
       paint of the next page rather than flashing the live version.
       "botanical" was an alternate until it became the live palette, so a
       value stored from then means the live one. The ground treatments were
       retired and the translucent Join button went live, so their stored
       keys are cleared rather than left behind. */
    var savedPal = null;
    try{
      savedPal = localStorage.getItem("canary-palette");
      if(savedPal === "botanical"){
        savedPal = "";
        localStorage.removeItem("canary-palette");
      }
      localStorage.removeItem("canary-ground");
      localStorage.removeItem("canary-join");
    }catch(e){}
    if(savedPal){ document.documentElement.dataset.palette = savedPal; }

    /* The testing panel: bottom-right at every width, holding every test
       control. Add one with build(id, label, options, saved, apply). It
       lives on <body> rather than in the header, because the header's
       backdrop-filter makes it the containing block for position:fixed
       descendants and would pin the panel to the header. */
    var panel = document.createElement("div");
    panel.className = "test-tools";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "Testing options");

    function build(id, label, opts, current, apply){
      var lab = document.createElement("label");
      lab.className = "visually-hidden";
      lab.setAttribute("for", id);
      lab.textContent = label;
      var sel = document.createElement("select");
      sel.id = id;
      sel.title = label;
      opts.forEach(function(o){
        var op = document.createElement("option");
        op.value = o[0];
        op.textContent = o[1];
        if(o[0] === (current || "")){ op.selected = true; }
        sel.appendChild(op);
      });
      sel.addEventListener("change", function(){ apply(sel.value); });
      panel.appendChild(lab);
      panel.appendChild(sel);
    }

    build("paletteSel", "Palette (testing)", PALETTES, savedPal, function(v){
      if(v){ document.documentElement.dataset.palette = v; }
      else { delete document.documentElement.dataset.palette; }
      try{ localStorage.setItem("canary-palette", v); }catch(e){}
      repaintModel();
      syncChrome();
    });

    document.body.appendChild(panel);

    /* The model's drop shadow is a CSS filter over the page ground, so a
       palette change leaves the previous ground baked into the composited
       layer until something forces a repaint. */
    function repaintModel(){
      var mv = document.querySelector(".model-stage model-viewer");
      if(!mv) return;
      mv.style.willChange = "filter";
      requestAnimationFrame(function(){ mv.style.willChange = ""; });
    }

    /* Phones tint the address bar from <meta name="theme-color">, which is
       a literal in each page. Left alone, the browser chrome keeps the live
       ground above a page showing an alternate, and that seam is exactly
       what would skew a judgement made on a phone. The token is read once
       the sheet has applied, not before. */
    var chrome = document.querySelector('meta[name="theme-color"]');
    function syncChrome(){
      if(!chrome) return;
      requestAnimationFrame(function(){
        var col = getComputedStyle(document.documentElement)
          .getPropertyValue("--cream").trim();
        if(col){ chrome.setAttribute("content", col); }
      });
    }
    link.addEventListener("load", syncChrome);
  }

})();
