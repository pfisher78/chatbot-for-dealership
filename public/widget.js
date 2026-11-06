/**
 * Dealership AI Chat Widget
 * Embed on any page with:
 *   <script src="https://YOUR-CHATBOT-HOST/widget.js" async></script>
 *
 * All branding (colors, bot name, avatar, greeting, position) is pulled from
 * the server's /api/config endpoint, so the same script serves every
 * white-label deployment with zero code changes.
 */
(function () {
  "use strict";

  // Resolve the API base from wherever this script was loaded.
  var scriptEl = document.currentScript;
  var API_BASE = "";
  if (scriptEl && scriptEl.src) {
    var u = new URL(scriptEl.src);
    API_BASE = u.origin;
  }

  var cfg = null;
  var sessionId = null;
  var open = false;
  var busy = false;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "style") Object.assign(node.style, attrs[k]);
        else if (k === "text") node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function fetchJSON(path, opts) {
    return fetch(API_BASE + path, opts).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.error || ("HTTP " + r.status));
        return data;
      });
    });
  }

  function init() {
    fetchJSON("/api/config")
      .then(function (config) {
        cfg = config;
        render();
      })
      .catch(function (err) {
        console.error("[dealership-chat] failed to load config:", err);
      });
  }

  function ensureSession() {
    if (sessionId) return Promise.resolve(sessionId);
    var stored = null;
    try { stored = sessionStorage.getItem("dealershipChatSession"); } catch (e) {}
    if (stored) { sessionId = stored; return Promise.resolve(sessionId); }
    return fetchJSON("/api/session", { method: "POST" }).then(function (data) {
      sessionId = data.sessionId;
      try { sessionStorage.setItem("dealershipChatSession", sessionId); } catch (e) {}
      return sessionId;
    });
  }

  var panel, messagesBox, input, sendBtn, launcher;

  function render() {
    var b = cfg.branding;
    var isLeft = b.widgetPosition === "bottom-left";
    var sideStyle = isLeft ? { left: "20px" } : { right: "20px" };

    // Launcher bubble
    launcher = el("button", {
      "aria-label": "Open chat with " + b.botName,
      style: Object.assign({
        position: "fixed", bottom: "20px", zIndex: "2147483000",
        width: "60px", height: "60px", borderRadius: "50%",
        border: "none", cursor: "pointer", fontSize: "26px",
        background: b.primaryColor, color: "#fff",
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 0.15s ease"
      }, sideStyle),
      text: b.botAvatar || "💬"
    });
    launcher.onmouseenter = function () { launcher.style.transform = "scale(1.08)"; };
    launcher.onmouseleave = function () { launcher.style.transform = "scale(1)"; };
    launcher.onclick = toggle;

    // Chat panel
    panel = el("div", {
      role: "dialog", "aria-label": b.botName,
      style: Object.assign({
        position: "fixed", bottom: "92px", zIndex: "2147483000",
        width: "min(380px, calc(100vw - 32px))",
        height: "min(560px, calc(100vh - 120px))",
        display: "none", flexDirection: "column",
        background: b.backgroundColor || "#fff",
        color: b.textColor || "#1c1c1e",
        fontFamily: b.fontFamily,
        borderRadius: "16px", overflow: "hidden",
        boxShadow: "0 8px 40px rgba(0,0,0,0.28)"
      }, sideStyle)
    });

    // Header
    var headerChildren = [];
    if (b.logoUrl) {
      headerChildren.push(el("img", {
        src: b.logoUrl, alt: "",
        style: { height: "28px", marginRight: "10px", borderRadius: "4px" }
      }));
    } else {
      headerChildren.push(el("span", {
        text: b.botAvatar || "💬",
        style: { fontSize: "22px", marginRight: "10px" }
      }));
    }
    var titleWrap = el("div", null, [
      el("div", { text: b.botName, style: { fontWeight: "600", fontSize: "15px" } }),
      el("div", { text: cfg.dealershipName, style: { fontSize: "12px", opacity: "0.85" } })
    ]);
    headerChildren.push(titleWrap);
    var closeBtn = el("button", {
      "aria-label": "Close chat",
      text: "✕",
      style: {
        marginLeft: "auto", background: "transparent", border: "none",
        color: "#fff", fontSize: "16px", cursor: "pointer", padding: "4px 8px"
      }
    });
    closeBtn.onclick = toggle;
    headerChildren.push(closeBtn);

    panel.appendChild(el("div", {
      style: {
        display: "flex", alignItems: "center",
        padding: "14px 16px", background: b.primaryColor, color: "#fff"
      }
    }, headerChildren));

    // Messages area
    messagesBox = el("div", {
      style: {
        flex: "1", overflowY: "auto", padding: "16px",
        display: "flex", flexDirection: "column", gap: "10px",
        fontSize: "14px", lineHeight: "1.45"
      }
    });
    panel.appendChild(messagesBox);

    // Composer
    input = el("textarea", {
      rows: "1", placeholder: "Type a message…",
      "aria-label": "Message",
      style: {
        flex: "1", resize: "none", border: "none", outline: "none",
        fontFamily: b.fontFamily, fontSize: "14px", padding: "10px 12px",
        background: "transparent", color: b.textColor || "#1c1c1e", maxHeight: "90px"
      }
    });
    sendBtn = el("button", {
      "aria-label": "Send", text: "➤",
      style: {
        border: "none", cursor: "pointer", fontSize: "16px",
        background: b.accentColor || b.primaryColor, color: "#fff",
        borderRadius: "10px", width: "38px", height: "38px",
        margin: "6px", flexShrink: "0"
      }
    });
    sendBtn.onclick = send;
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });

    panel.appendChild(el("div", {
      style: {
        display: "flex", alignItems: "flex-end",
        borderTop: "1px solid rgba(0,0,0,0.1)"
      }
    }, [input, sendBtn]));

    // Footer
    panel.appendChild(el("div", {
      text: "AI assistant — for anything urgent, ring " + cfg.phone,
      style: {
        fontSize: "11px", opacity: "0.6", textAlign: "center",
        padding: "6px 10px 10px"
      }
    }));

    document.body.appendChild(panel);
    document.body.appendChild(launcher);
  }

  function toggle() {
    open = !open;
    panel.style.display = open ? "flex" : "none";
    if (open) {
      if (messagesBox.childElementCount === 0 && cfg.branding.greeting) {
        addMessage("bot", cfg.branding.greeting);
      }
      input.focus();
    }
  }

  function addMessage(who, text) {
    var b = cfg.branding;
    var isBot = who === "bot";
    var bubble = el("div", {
      style: {
        maxWidth: "85%", padding: "10px 13px", borderRadius: "14px",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        alignSelf: isBot ? "flex-start" : "flex-end",
        background: isBot ? "rgba(0,0,0,0.06)" : b.primaryColor,
        color: isBot ? (b.textColor || "#1c1c1e") : "#fff",
        borderBottomLeftRadius: isBot ? "4px" : "14px",
        borderBottomRightRadius: isBot ? "14px" : "4px"
      },
      text: text
    });
    messagesBox.appendChild(bubble);
    messagesBox.scrollTop = messagesBox.scrollHeight;
    return bubble;
  }

  function addTyping() {
    var bubble = addMessage("bot", "…");
    bubble.setAttribute("data-typing", "1");
    var dots = 1;
    var timer = setInterval(function () {
      dots = (dots % 3) + 1;
      bubble.textContent = ".".repeat(dots);
    }, 350);
    return function remove() {
      clearInterval(timer);
      bubble.remove();
    };
  }

  function send() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    addMessage("user", text);
    busy = true;
    sendBtn.style.opacity = "0.5";
    var removeTyping = addTyping();

    ensureSession()
      .then(function (sid) {
        return fetchJSON("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, message: text })
        });
      })
      .then(function (data) {
        removeTyping();
        addMessage("bot", data.reply);
      })
      .catch(function (err) {
        removeTyping();
        addMessage("bot", err.message || "Sorry, something went wrong. Please try again or give us a call.");
      })
      .then(function () {
        busy = false;
        sendBtn.style.opacity = "1";
        input.focus();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
