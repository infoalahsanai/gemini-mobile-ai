document.addEventListener("DOMContentLoaded", () => {
  const chatBox = document.getElementById("chatBox");
  const welcomeMsg = document.getElementById("welcomeMsg");
  const promptInput = document.getElementById("promptInput");
  const sendBtn = document.getElementById("sendBtn");
  const modelPicker = document.getElementById("modelPicker");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsModal = document.getElementById("settingsModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const saveKeyBtn = document.getElementById("saveKeyBtn");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const fetchModelsBtn = document.getElementById("fetchModelsBtn");
  const statusText = document.getElementById("statusText");

  // Storage helper for Extension (chrome.storage) or Web (localStorage)
  const Storage = {
    get: (key, cb) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([key], (res) => cb(res[key]));
      } else {
        cb(localStorage.getItem(key));
      }
    },
    set: (key, val, cb) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [key]: val }, cb);
      } else {
        localStorage.setItem(key, val);
        if (cb) cb();
      }
    }
  };

  let savedKey = "";

  Storage.get("geminiApiKey", (k) => {
    if (k) {
      savedKey = k;
      apiKeyInput.value = k;
    }
  });

  Storage.get("geminiModel", (m) => {
    if (m) modelPicker.value = m;
  });

  settingsBtn.addEventListener("click", () => settingsModal.classList.add("active"));
  closeModalBtn.addEventListener("click", () => settingsModal.classList.remove("active"));

  saveKeyBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      alert("API Key লিখুন!");
      return;
    }
    Storage.set("geminiApiKey", key, () => {
      Storage.set("geminiModel", modelPicker.value, () => {
        savedKey = key;
        settingsModal.classList.remove("active");
        alert("API Key সফলভাবে সেভ হয়েছে!");
      });
    });
  });

  modelPicker.addEventListener("change", () => {
    Storage.set("geminiModel", modelPicker.value);
  });

  // Fetch all models available for this API Key
  fetchModelsBtn.addEventListener("click", async () => {
    const key = apiKeyInput.value.trim() || savedKey;
    if (!key) {
      statusText.textContent = "আগে API Key দিন!";
      statusText.style.color = "#f87171";
      return;
    }

    statusText.textContent = "গুগল থেকে মডেল লোড হচ্ছে...";
    statusText.style.color = "#38bdf8";

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error?.message || "ব্যর্থ হয়েছে");

      const models = (data.models || []).filter(m => 
        m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
      );

      if (models.length > 0) {
        modelPicker.innerHTML = "";
        models.forEach(m => {
          const short = m.name.replace("models/", "");
          const opt = document.createElement("option");
          opt.value = short;
          opt.textContent = m.displayName ? `${m.displayName} (${short})` : short;
          if (short === "gemini-1.5-flash" || short === "gemini-2.0-flash") {
            opt.selected = true;
          }
          modelPicker.appendChild(opt);
        });
        statusText.textContent = `সফল! ${models.length}টি মডেল পাওয়া গেছে।`;
        statusText.style.color = "#4ade80";
      }
    } catch (err) {
      statusText.textContent = "ত্রুটি: " + err.message;
      statusText.style.color = "#f87171";
    }
  });

  function appendMsg(text, role) {
    if (welcomeMsg) welcomeMsg.style.display = "none";
    const div = document.createElement("div");
    div.className = `msg ${role}`;

    if (role === "ai") {
      const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      div.innerHTML = escaped.replace(/```([a-zA-Z0-9_-]*)
([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><button class="copy-code" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText);this.innerText='কপি হয়েছে!';setTimeout(()=>this.innerText='কপি',1500)">কপি</button><code>${code.trim()}</code></pre>`;
      }).replace(/\n/g, "<br>");
    } else {
      div.textContent = text;
    }

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
  }

  async function send() {
    const text = promptInput.value.trim();
    if (!savedKey) {
      settingsModal.classList.add("active");
      alert("প্রথমে ⚙️ সেটিংসে গিয়ে আপনার Gemini API Key সেভ করুন।");
      return;
    }
    if (!text) return;

    appendMsg(text, "user");
    promptInput.value = "";
    sendBtn.disabled = true;

    const aiDiv = appendMsg("উত্তর তৈরি হচ্ছে...", "ai");

    try {
      const model = modelPicker.value;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${savedKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text }] }] })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "রিকোয়েস্ট ব্যর্থ হয়েছে");

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "কোনো উত্তর পাওয়া যায়নি।";
      const escaped = reply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      aiDiv.innerHTML = escaped.replace(/```([a-zA-Z0-9_-]*)
([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><button class="copy-code" onclick="navigator.clipboard.writeText(this.nextElementSibling.innerText);this.innerText='কপি হয়েছে!';setTimeout(()=>this.innerText='কপি',1500)">কপি</button><code>${code.trim()}</code></pre>`;
      }).replace(/\n/g, "<br>");
    } catch (err) {
      aiDiv.innerHTML = `<span style="color:#f87171;">ত্রুটি: ${err.message}</span>`;
    } finally {
      sendBtn.disabled = false;
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }

  sendBtn.addEventListener("click", send);
  promptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
});
