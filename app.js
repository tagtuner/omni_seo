// OmniSEO Command Center — Telemetry & Interaction Controller
document.addEventListener('DOMContentLoaded', () => {
    
    // DOM Elements
    const botToggle = document.getElementById('bot-engage-toggle');
    const botPulse = document.getElementById('bot-pulse');
    const botStatusText = document.getElementById('bot-status-text');
    const engageStatusLabel = document.getElementById('engage-status-label');
    const liveIndicator = document.getElementById('live-indicator');
    
    const durationSlider = document.getElementById('campaign-duration');
    const durationVal = document.getElementById('duration-val');
    const timelineBadgeText = document.getElementById('timeline-badge-text');
    
    const targetDomain = document.getElementById('target-domain');
    const targetKeyword = document.getElementById('target-keyword');
    const botPrompt = document.getElementById('bot-prompt');
    
    const hostProtocol = document.getElementById('host-protocol');
    const hostIp = document.getElementById('host-ip');
    const hostUser = document.getElementById('host-user');
    const btnTestConn = document.getElementById('btn-test-connection');
    const connBtnText = document.getElementById('conn-btn-text');
    const handshakeResult = document.getElementById('handshake-result');
    
    const pipelinePercentText = document.getElementById('pipeline-percent-text');
    const pipelineProgressBar = document.getElementById('pipeline-progress-bar');
    
    const terminalOutput = document.getElementById('terminal-log-output');
    const envModeBadge = document.getElementById('env-mode-badge');
    
    const llmProvider = document.getElementById('llm-provider');
    const llmModel = document.getElementById('llm-model');
    const llmApiKey = document.getElementById('llm-api-key');
    const apifyToken = document.getElementById('apify-token');

    // Sidebar campaigns DOM elements
    const campaignListWrapper = document.getElementById('campaign-list-wrapper');
    const btnNewCampaign = document.getElementById('btn-new-campaign');

    // Chatbot DOM elements
    const chatbotWidget = document.getElementById('chatbot-widget');
    const chatbotToggleBtn = document.getElementById('chatbot-toggle-btn');
    const chatCloseBtn = document.getElementById('chat-close-btn');
    const chatForm = document.getElementById('chat-form');
    const chatUserInput = document.getElementById('chat-user-input');
    const chatMessagesContainer = document.getElementById('chat-messages-container');
    const chatFreeMode = document.getElementById('chat-free-mode');
    const chatNotificationBadge = document.getElementById('chat-notification-badge');
    const techStackBadge = document.getElementById('tech-stack-badge');
    const auditOnlyToggle = document.getElementById('audit-only-toggle');

    // Task DOM Elements
    const tasks = {
        audit: { item: document.getElementById('task-audit'), badge: document.getElementById('badge-audit') },
        keywords: { item: document.getElementById('task-keywords'), badge: document.getElementById('badge-keywords') },
        writing: { item: document.getElementById('task-writing'), badge: document.getElementById('badge-writing') },
        deploy: { item: document.getElementById('task-deploy'), badge: document.getElementById('badge-deploy') },
        index: { item: document.getElementById('task-index'), badge: document.getElementById('badge-index') },
        offpage: { item: document.getElementById('task-offpage'), badge: document.getElementById('badge-offpage') }
    };

    // Competitor DOM Elements
    const comp1Name = document.getElementById('comp1-name');
    const comp1Url = document.getElementById('comp1-url');
    const comp2Name = document.getElementById('comp2-name');
    const comp2Url = document.getElementById('comp2-url');
    const compUsUrl = document.getElementById('comp-us-url');
    const compUsTitle = document.getElementById('comp-us-title');

    const metrics = {
        us: { da: document.getElementById('metric-us-da'), backlinks: document.getElementById('metric-us-backlinks'), speed: document.getElementById('metric-us-speed'), schema: document.getElementById('metric-us-schema') },
        comp1: { da: document.getElementById('metric-comp1-da'), backlinks: document.getElementById('metric-comp1-backlinks'), speed: document.getElementById('metric-comp1-speed'), schema: document.getElementById('metric-comp1-schema') },
        comp2: { da: document.getElementById('metric-comp2-da'), backlinks: document.getElementById('metric-comp2-backlinks'), speed: document.getElementById('metric-comp2-speed'), schema: document.getElementById('metric-comp2-schema') }
    };

    const gaps = {
        backlinks: document.getElementById('gap-backlinks'),
        speed: document.getElementById('gap-speed'),
        schema: document.getElementById('gap-schema')
    };

    // State Variables
    let selectedCampaignId = null;
    let campaignsList = [];
    let botRunning = false;
    let botInterval = null;
    let eventSource = null;
    let logIndex = 0;
    let currentProgress = 0;
    let isHydrating = false;
    let isLiveMode = false;
    let isFirstLoad = true;

    // Competitor Profiles Database
    const competitorDb = [
        {
            keywords: ['tax', 'finance', 'salary', 'income'],
            comp1: { name: 'taxcalculator.org', url: 'https://taxcalculator.org', da: 74, backlinks: 24500, speed: 480, schema: false },
            comp2: { name: 'finance-pro.com', url: 'https://finance-pro.com', da: 48, backlinks: 4120, speed: 210, schema: true }
        },
        {
            keywords: ['currency', 'exchange', 'usd', 'pkr', 'inr', 'convert'],
            comp1: { name: 'xe-rates-clone.net', url: 'https://xe-rates-clone.net', da: 82, backlinks: 185000, speed: 620, schema: true },
            comp2: { name: 'quick-converter.io', url: 'https://quick-converter.io', da: 39, backlinks: 1980, speed: 180, schema: false }
        },
        {
            keywords: ['default', 'seo', 'web'],
            comp1: { name: 'rankone-leader.com', url: 'https://rankone-leader.com', da: 65, backlinks: 12400, speed: 510, schema: false },
            comp2: { name: 'niche-authority.com', url: 'https://niche-authority.com', da: 41, backlinks: 2850, speed: 340, schema: true }
        }
    ];

    // Environment Mode Toggle Handler
    if (envModeBadge) {
        envModeBadge.style.cursor = 'pointer';
        envModeBadge.addEventListener('click', () => {
            isLiveMode = !isLiveMode;
            if (isLiveMode) {
                envModeBadge.className = "environment-badge live";
                envModeBadge.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> <span>LIVE RUN ACTIVE</span>`;
                addTerminalLog("[SYSTEM] Environment switched to LIVE RUN MODE. Server SSH pipelines engaged.", "terminal-info-msg");
            } else {
                envModeBadge.className = "environment-badge simulation";
                envModeBadge.innerHTML = `<i class="fa-solid fa-flask"></i> <span>SIMULATION MODE</span>`;
                addTerminalLog("[SYSTEM] Environment switched to local SIMULATION MODE.", "terminal-system-msg");
            }
            saveState();
            fetchCampaigns();
        });
    }

    // Dynamic model selection based on LLM Provider
    llmProvider.addEventListener('change', () => {
        const val = llmProvider.value;
        llmModel.innerHTML = '';
        if (val === 'gemini') {
            llmModel.innerHTML = `
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            `;
        } else if (val === 'openrouter') {
            llmModel.innerHTML = `
                <option value="openrouter/free" selected>Auto-Route Free Model</option>
                <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B Free</option>
                <option value="google/gemma-4-31b-it:free">Gemma 4 31B Free</option>
                <option value="meta-llama/llama-3.2-3b-instruct:free">Llama 3.2 3B Free</option>
            `;
        }
        saveState();
    });

    if (hostProtocol) {
        hostProtocol.addEventListener('change', () => {
            const portInput = document.getElementById('host-port');
            if (hostProtocol.value === 'ftp') {
                portInput.value = '21';
            } else {
                portInput.value = '22';
            }
            saveState();
        });
    }

    // 1. Duration Slider Handler
    durationSlider.addEventListener('input', () => {
        updateDurationBadge();
    });

    function updateDurationBadge() {
        const val = durationSlider.value;
        durationVal.textContent = `${val} Month${val > 1 ? 's' : ''}`;
        timelineBadgeText.textContent = `${val * 30}-Day Campaign`;
        
        if (botRunning) {
            addTerminalLog(`[SYSTEM] Campaign timeframe dynamically adjusted to ${val * 30} days.`, 'terminal-warning-msg');
        }
        saveState();
    }

    function updateTechStackUI(stack) {
        if (!techStackBadge) return;
        
        const displayStack = stack || 'unknown';
        techStackBadge.innerHTML = `<i class="fa-solid fa-microchip"></i> Stack: ${displayStack}`;
        
        techStackBadge.className = 'tech-stack-badge';
        
        const s = displayStack.toLowerCase();
        if (s.includes('wordpress')) {
            techStackBadge.classList.add('wordpress');
        } else if (s.includes('shopify')) {
            techStackBadge.classList.add('shopify');
        } else if (s.includes('next.js') || s.includes('nextjs')) {
            techStackBadge.classList.add('nextjs');
        } else if (s.includes('static')) {
            techStackBadge.classList.add('static');
        }
    }

    // 2. Keyword & Domain Input handlers to dynamically update competitor cards
    targetKeyword.addEventListener('input', debounce(recalculateCompetitors, 600));
    targetDomain.addEventListener('input', () => {
        const domain = targetDomain.value.trim() || 'omnicalc.com';
        compUsUrl.textContent = domain.startsWith('http') ? domain : `https://${domain}`;
        let cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
        compUsTitle.textContent = cleanDomain || 'omnicalc.com';
    });

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function recalculateCompetitors() {
        const kw = targetKeyword.value.toLowerCase();
        let matched = competitorDb[2];

        for (let entry of competitorDb) {
            if (entry.keywords.some(k => kw.includes(k))) {
                matched = entry;
                break;
            }
        }

        comp1Name.textContent = matched.comp1.name;
        comp1Url.textContent = matched.comp1.url;
        metrics.comp1.da.textContent = `DA ${matched.comp1.da}`;
        metrics.comp1.backlinks.textContent = matched.comp1.backlinks.toLocaleString();
        metrics.comp1.speed.textContent = `${matched.comp1.speed}ms`;
        metrics.comp1.schema.innerHTML = matched.comp1.schema 
            ? `<i class="fa-solid fa-circle-check" style="color:#00f5a0;"></i> Complete` 
            : `<i class="fa-solid fa-circle-xmark" style="color:#ff0844;"></i> Missing FAQ`;

        comp2Name.textContent = matched.comp2.name;
        comp2Url.textContent = matched.comp2.url;
        metrics.comp2.da.textContent = `DA ${matched.comp2.da}`;
        metrics.comp2.backlinks.textContent = matched.comp2.backlinks.toLocaleString();
        metrics.comp2.speed.textContent = `${matched.comp2.speed}ms`;
        metrics.comp2.schema.innerHTML = matched.comp2.schema 
            ? `<i class="fa-solid fa-circle-check" style="color:#00f5a0;"></i> Complete` 
            : `<i class="fa-solid fa-circle-xmark" style="color:#ff0844;"></i> Missing FAQ`;

        const usDa = Math.max(10, Math.floor(matched.comp2.da * 0.35));
        const usBacklinks = Math.max(5, Math.floor(matched.comp2.backlinks * 0.12));
        const usSpeed = 102;

        metrics.us.da.textContent = `DA ${usDa}`;
        metrics.us.backlinks.textContent = usBacklinks.toLocaleString();
        metrics.us.speed.textContent = `${usSpeed}ms`;

        const backlinkGap = matched.comp1.backlinks - usBacklinks;
        gaps.backlinks.textContent = `-${backlinkGap.toLocaleString()} Backlinks`;

        const speedGap = matched.comp1.speed - usSpeed;
        gaps.speed.textContent = `+${speedGap}ms Faster`;

        if (matched.comp1.schema) {
            gaps.schema.innerHTML = `We Have Advantage`;
            gaps.schema.parentElement.className = "gap-item-card optimum";
            gaps.schema.nextElementSibling.innerHTML = `<i class="fa-solid fa-circle-check"></i> Bot is injecting Software & FAQ JSON-LD markup. Core structure verified.`;
        } else {
            gaps.schema.innerHTML = `Gap Discovered`;
            gaps.schema.parentElement.className = "gap-item-card warning";
            gaps.schema.nextElementSibling.innerHTML = `<i class="fa-solid fa-circle-info"></i> Target competitor lacks structured search schema. Bot will exploit this gap first.`;
        }

        if (botRunning) {
            addTerminalLog(`[CRAWLER] Recalculating competitor parameters for keyword: "${targetKeyword.value}"`, 'terminal-info-msg');
        }
        saveState();
    }

    function updateCompetitorUI(comp1_name, comp1_url, comp2_name, comp2_url) {
        if (!comp1_name || !comp2_name) return;
        
        comp1Name.textContent = comp1_name.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        comp1Url.textContent = comp1_url;
        comp1Url.href = comp1_url;
        comp1Url.target = "_blank";
        
        comp2Name.textContent = comp2_name.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        comp2Url.textContent = comp2_url;
        comp2Url.href = comp2_url;
        comp2Url.target = "_blank";
        
        // Dynamic DA/Backlinks heuristics
        let da1 = 35;
        let backlinks1 = 1200;
        let da2 = 28;
        let backlinks2 = 450;
        
        const url1 = comp1_url.toLowerCase();
        const url2 = comp2_url.toLowerCase();
        
        if (url1.includes('tripadvisor') || url1.includes('wikipedia') || url1.includes('booking') || url1.includes('facebook')) {
            da1 = 93;
            backlinks1 = 4500000;
        } else if (url1.includes('blog') || url1.includes('news')) {
            da1 = 48;
            backlinks1 = 8900;
        } else if (url1.includes('umrah') || url1.includes('taxi')) {
            da1 = 18;
            backlinks1 = 280;
        }
        
        if (url2.includes('tripadvisor') || url2.includes('wikipedia') || url2.includes('booking') || url2.includes('facebook')) {
            da2 = 93;
            backlinks2 = 4500000;
        } else if (url2.includes('blog') || url2.includes('news')) {
            da2 = 48;
            backlinks2 = 8900;
        } else if (url2.includes('umrah') || url2.includes('taxi')) {
            da2 = 16;
            backlinks2 = 190;
        }
        
        metrics.comp1.da.textContent = `DA ${da1}`;
        metrics.comp1.backlinks.textContent = backlinks1.toLocaleString();
        metrics.comp1.speed.textContent = `210ms`;
        metrics.comp1.schema.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#00f5a0;"></i> Complete`;
        
        metrics.comp2.da.textContent = `DA ${da2}`;
        metrics.comp2.backlinks.textContent = backlinks2.toLocaleString();
        metrics.comp2.speed.textContent = `340ms`;
        metrics.comp2.schema.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color:#ff0844;"></i> Missing FAQ`;
        
        // Recalculate gaps
        const ourBacklinks = parseInt(metrics.us.backlinks.textContent.replace(/,/g, '')) || 494;
        const backlinkGap = backlinks1 - ourBacklinks;
        gaps.backlinks.textContent = `-${backlinkGap.toLocaleString()} Backlinks`;
        
        gaps.schema.innerHTML = `Gap Discovered`;
        gaps.schema.parentElement.className = "gap-item-card warning";
        gaps.schema.nextElementSibling.innerHTML = `<i class="fa-solid fa-circle-info"></i> Target competitor lacks structured search schema. Bot will exploit this gap first.`;
    }

    function renderLeads(leads) {
        const tableBody = document.getElementById('leads-table-body');
        const badgeCount = document.getElementById('leads-count-badge');
        
        if (!tableBody) return;
        
        if (typeof leads === 'string') {
            try {
                leads = JSON.parse(leads);
            } catch(e) {
                leads = [];
            }
        }
        
        const leadsList = Array.isArray(leads) ? leads : [];
        
        if (badgeCount) {
            badgeCount.textContent = leadsList.length;
        }
        
        if (leadsList.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-leads-msg">No outreach leads scanned yet. Run a campaign to trigger the contact details scraper.</td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = '';
        leadsList.forEach(lead => {
            const domain = lead.domain || 'N/A';
            const email = lead.email || 'N/A';
            const phone = lead.phone || 'N/A';
            
            let socialsHTML = '';
            if (lead.linkedin) {
                socialsHTML += `<a href="${lead.linkedin}" target="_blank" class="social-link" title="LinkedIn Profile"><i class="fa-brands fa-linkedin"></i></a>`;
            }
            if (lead.twitter) {
                socialsHTML += `<a href="${lead.twitter}" target="_blank" class="social-link" title="Twitter Profile"><i class="fa-brands fa-twitter"></i></a>`;
            }
            if (!socialsHTML) {
                socialsHTML = '<span style="color:var(--text-muted); font-size:0.75rem;">None</span>';
            }
            
            const tr = document.createElement('tr');
            const displayDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
            const domainLink = domain.startsWith('http') ? domain : `https://${domain}`;
            
            tr.innerHTML = `
                <td><a href="${domainLink}" target="_blank">${displayDomain}</a></td>
                <td>${email !== 'N/A' && email ? `<a href="mailto:${email}">${email}</a>` : '<span style="color:var(--text-muted);">Not Found</span>'}</td>
                <td>${phone !== 'N/A' && phone ? phone : '<span style="color:var(--text-muted);">Not Found</span>'}</td>
                <td><div class="social-links-wrapper">${socialsHTML}</div></td>
                <td class="actions-col">
                    ${(email && email !== 'N/A') ? `
                        <button type="button" class="btn-pitch" data-domain="${displayDomain}" data-email="${email}">
                            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Pitch
                        </button>
                    ` : `
                        <button type="button" class="btn-pitch" style="opacity:0.4; cursor:not-allowed;" disabled>
                            <i class="fa-solid fa-ban"></i> No Email
                        </button>
                    `}
                </td>
            `;
            
            const pitchBtn = tr.querySelector('.btn-pitch');
            if (pitchBtn && !pitchBtn.disabled) {
                pitchBtn.addEventListener('click', () => {
                    handleGeneratePitch(displayDomain, email);
                });
            }
            
            tableBody.appendChild(tr);
        });
    }

    function displayOutreachPitch(pitchText) {
        chatbotWidget.classList.add('open');
        chatNotificationBadge.style.display = 'none';
        appendChatMessage(`Here is your personalized AI Outreach Pitch:\n\n${pitchText}`, 'bot');
    }

    function handleGeneratePitch(domain, email) {
        if (!selectedCampaignId || String(selectedCampaignId).startsWith('sim_')) {
            const mockPitch = `Subject: Quick Question regarding ${domain}

Hello,

I came across your site at ${domain} and loved your coverage of topic-relevant guides.

We recently launched a fully interactive, mobile-optimized calculator tool for "${targetKeyword.value}" on ${targetDomain.value}. Unlike the standard static tables on sites like ${comp1Name.textContent}, ours allows users to estimate their values in real-time.

I thought this would make an excellent resource addition for your readers. Let me know if you would be open to taking a look!

Best regards,
OmniSEO Outbound Agent`;
            
            displayOutreachPitch(mockPitch);
            return;
        }
        
        const btn = document.querySelector(`.btn-pitch[data-domain="${domain}"][data-email="${email}"]`);
        let oldHTML = '';
        if (btn) {
            oldHTML = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Pitching...`;
            btn.disabled = true;
        }
        
        fetch(`/api/campaigns/${selectedCampaignId}/generate-pitch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                domain: domain,
                email: email,
                api: {
                    llm_provider: llmProvider.value,
                    llm_model: llmModel.value,
                    llm_api_key: llmApiKey.value,
                    free_mode: chatFreeMode.checked
                }
            })
        })
        .then(res => res.json())
        .then(data => {
            if (btn) {
                btn.innerHTML = oldHTML;
                btn.disabled = false;
            }
            if (data.status === 'success') {
                displayOutreachPitch(data.pitch);
            } else {
                alert(`Failed to generate pitch: ${data.message}`);
            }
        })
        .catch(err => {
            if (btn) {
                btn.innerHTML = oldHTML;
                btn.disabled = false;
            }
            alert(`Network error: ${err.message}`);
        });
    }

    function initCompetitorTabs() {
        const tabGap = document.getElementById('tab-comp-gap');
        const tabLeads = document.getElementById('tab-comp-leads');
        const paneGap = document.getElementById('pane-comp-gap');
        const paneLeads = document.getElementById('pane-comp-leads');
        
        if (tabGap && tabLeads && paneGap && paneLeads) {
            tabGap.addEventListener('click', () => {
                tabGap.classList.add('active');
                tabLeads.classList.remove('active');
                paneGap.classList.add('active');
                paneLeads.classList.remove('active');
            });
            
            tabLeads.addEventListener('click', () => {
                tabLeads.classList.add('active');
                tabGap.classList.remove('active');
                paneLeads.classList.add('active');
                paneGap.classList.remove('active');
            });
        }
    }

    // Call competitor tabs initialization
    initCompetitorTabs();

    // 3. Test Hosting Handshake
    btnTestConn.addEventListener('click', () => {
        connBtnText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking Access...`;
        handshakeResult.className = "handshake-status loading";
        handshakeResult.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating`;
        btnTestConn.disabled = true;

        if (isLiveMode) {
            fetch('/api/test-handshake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    protocol: hostProtocol.value,
                    host: hostIp.value,
                    username: hostUser.value,
                    port: parseInt(document.getElementById('host-port').value || (hostProtocol.value === 'ftp' ? '21' : '22')),
                    password: document.getElementById('host-pass').value
                })
            })
            .then(res => res.json())
            .then(data => {
                connBtnText.innerHTML = `<i class="fa-solid fa-rotate"></i> Test Handshake`;
                btnTestConn.disabled = false;
                if (data.status === 'success') {
                    handshakeResult.className = "handshake-status success";
                    handshakeResult.innerHTML = `<i class="fa-solid fa-circle-check"></i> Handshake OK`;
                    addTerminalLog(`[AUTH] ${hostProtocol.value.toUpperCase()} connection verified with ${hostIp.value}. Write permissions checked.`, 'terminal-success-msg');
                } else {
                    handshakeResult.className = "handshake-status error";
                    handshakeResult.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Handshake Failed`;
                    addTerminalLog(`[AUTH] ${hostProtocol.value.toUpperCase()} connection failed: ${data.message}`, 'terminal-error-msg');
                }
            })
            .catch(err => {
                connBtnText.innerHTML = `<i class="fa-solid fa-rotate"></i> Test Handshake`;
                btnTestConn.disabled = false;
                handshakeResult.className = "handshake-status error";
                handshakeResult.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Connection Error`;
                addTerminalLog(`[SYSTEM] Handshake API Error: ${err.message}`, 'terminal-error-msg');
            });
        } else {
            setTimeout(() => {
                connBtnText.innerHTML = `<i class="fa-solid fa-rotate"></i> Test Handshake`;
                handshakeResult.className = "handshake-status success";
                handshakeResult.innerHTML = `<i class="fa-solid fa-circle-check"></i> Handshake OK`;
                btnTestConn.disabled = false;
                addTerminalLog(`[AUTH] [SIMULATION] ${hostProtocol.value.toUpperCase()} handshake with ${hostIp.value || '172.30.3.206'} successful.`, 'terminal-success-msg');
            }, 1500);
        }
    });

    // 4. "ENGAGE BOT" Master Switch & Simulation Engine
    botToggle.addEventListener('change', () => {
        if (botToggle.checked) {
            startBot();
        } else {
            stopBot();
        }
    });

    function startBot() {
        botRunning = true;
        botPulse.className = "status-indicator running";
        botStatusText.textContent = "BOT ENGAGED";
        engageStatusLabel.textContent = "BOT ACTIVE";
        engageStatusLabel.style.color = "var(--neon-green)";
        liveIndicator.className = "terminal-badge pulse-green";
        liveIndicator.textContent = "RUNNING";

        const config = {
            domain: targetDomain.value,
            keyword: targetKeyword.value,
            duration: parseInt(durationSlider.value),
            prompt: botPrompt.value,
            audit_only: auditOnlyToggle && auditOnlyToggle.checked ? 1 : 0,
            sftp: {
                protocol: hostProtocol.value,
                host: hostIp.value,
                username: hostUser.value,
                port: parseInt(document.getElementById('host-port').value || (hostProtocol.value === 'ftp' ? '21' : '22')),
                password: document.getElementById('host-pass').value
            },
            api: {
                llm_provider: llmProvider.value,
                llm_model: llmModel.value,
                llm_api_key: llmApiKey.value,
                apify_token: apifyToken.value
            }
        };

        if (isLiveMode) {
            // Check if selected campaign is already running or queued or monitoring
            const existingCamp = selectedCampaignId ? campaignsList.find(c => String(c.id) === String(selectedCampaignId)) : null;
            if (existingCamp) {
                if (existingCamp.status === 'running' || existingCamp.status === 'queued' || existingCamp.status === 'monitoring') {
                    addTerminalLog(`[SYSTEM] Re-connecting to active campaign (ID: ${selectedCampaignId})...`, 'terminal-system-msg');
                    connectCampaignStream(selectedCampaignId);
                    return;
                } else if (existingCamp.status === 'paused' || existingCamp.status === 'completed' || existingCamp.status === 'failed') {
                    addTerminalLog(`[SYSTEM] Re-engaging campaign (ID: ${selectedCampaignId})...`, 'terminal-system-msg');
                    fetch(`/api/campaigns/${selectedCampaignId}/resume`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data.status === 'success') {
                            fetchCampaigns();
                            connectCampaignStream(selectedCampaignId);
                        } else {
                            addTerminalLog(`[SYSTEM] Failed to re-engage campaign: ${data.message}`, 'terminal-error-msg');
                            stopBot();
                        }
                    })
                    .catch(err => {
                        addTerminalLog(`[SYSTEM] Connection error: ${err.message}`, 'terminal-error-msg');
                        stopBot();
                    });
                    return;
                }
            }

            addTerminalLog(`[SYSTEM] Live Autopilot sequence initiated. Connecting backend...`, 'terminal-system-msg');
            
            fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            })
            .then(res => res.json())
            .then(data => {
                if (data.status !== 'success') {
                    addTerminalLog(`[SYSTEM] Failed to start campaign: ${data.message}`, 'terminal-error-msg');
                    stopBot();
                    return;
                }
                selectedCampaignId = data.campaign.id;
                fetchCampaigns();
                connectCampaignStream(selectedCampaignId);
            })
            .catch(err => {
                addTerminalLog(`[SYSTEM] Connection error: ${err.message}`, 'terminal-error-msg');
                stopBot();
            });
        } else {
            // Simulation Mode local mockup campaign
            resetCampaignProgress();
            selectedCampaignId = 'sim_' + Date.now();
            addTerminalLog(`[SYSTEM] [SIMULATION] Autopilot sequence initiated.`, 'terminal-system-msg');
            botInterval = setInterval(simulateBotStep, 1500);
            
            // Add a mock campaign to the sidebar list
            const mockCamp = {
                id: selectedCampaignId,
                domain: targetDomain.value,
                keyword: targetKeyword.value,
                status: 'running',
                progress: 0
            };
            campaignsList.unshift(mockCamp);
            renderCampaignsSidebar();
        }
        saveState();
    }

    function stopBot() {
        botRunning = false;
        botPulse.className = "status-indicator idle";
        botStatusText.textContent = "SYSTEM STANDBY";
        engageStatusLabel.textContent = "ENGAGE BOT";
        engageStatusLabel.style.color = "var(--text-secondary)";
        liveIndicator.className = "terminal-badge pulse-red";
        liveIndicator.textContent = "STANDBY";

        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        clearInterval(botInterval);
        addTerminalLog(`[SYSTEM] Autopilot paused. Background tasks suspended.`, 'terminal-error-msg');
        
        if (selectedCampaignId && !String(selectedCampaignId).startsWith('sim_') && isLiveMode) {
            // Dynamic status sync on pause
            fetch(`/api/campaigns/${selectedCampaignId}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'paused' })
            }).then(() => fetchCampaigns());
        } else if (String(selectedCampaignId).startsWith('sim_')) {
            const item = campaignsList.find(c => c.id === selectedCampaignId);
            if (item) {
                item.status = 'failed';
                renderCampaignsSidebar();
            }
        }
        saveState();
    }

    function resetCampaignProgress() {
        currentProgress = 0;
        pipelinePercentText.textContent = "0%";
        pipelineProgressBar.style.width = "0%";
        
        // Reset stack badge to default Unknown state
        updateTechStackUI('unknown');
        
        Object.keys(tasks).forEach(key => {
            tasks[key].item.className = "task-item pending";
            tasks[key].badge.textContent = "Pending";
            tasks[key].item.querySelector('.task-status-icon').innerHTML = `<i class="fa-solid fa-spinner"></i>`;
        });
        logIndex = 0;
        terminalOutput.innerHTML = '';
        
        const codeView = document.getElementById('live-code-view');
        const renderFrame = document.getElementById('live-render-frame');
        if (codeView && renderFrame) {
            codeView.textContent = '<!-- Code will be streamed here live... -->';
            renderFrame.srcdoc = "<div style='color:#94a3b8; font-family:sans-serif; text-align:center; padding:40px; font-size:0.9rem;'>AI generated calculator will render here live during campaign execution.</div>";
        }
    }

    // High-Fidelity Simulation Telemetry array
    // High-Fidelity Simulation Telemetry array
    const botLogs = [
        { msg: "CRAWLER: Initiating technology stack auto-detection...", class: "terminal-info-msg", progress: 2, task: "audit", taskStatus: "active" },
        { msg: "CRAWLER: Homepage HTTP HTML structure scan matching signatures...", class: "terminal-info-msg", progress: 4, task: "audit" },
        { msg: "SYSTEM: Technology Stack locked: WordPress", class: "terminal-success-msg", progress: 10, task: "audit", tech_stack: "WordPress" },
        { msg: "BOT: Fetching robots.txt and sitemap index files...", class: "terminal-action-msg", progress: 12, task: "audit" },
        { msg: "BOT: Scanning site headers... X-Frame-Options: SAMEORIGIN verified. Cache-Control tags optimized.", class: "terminal-action-msg", progress: 14, task: "audit" },
        { msg: "BOT: Indexing 42 active URLs. Found 3 missing alt-text images.", class: "terminal-warning-msg", progress: 16, task: "audit" },
        { msg: "SUCCESS: Technical audit report compiled. Speed advantage locked: Us (102ms) vs. Competitor #1 (480ms).", class: "terminal-success-msg", progress: 20, task: "audit", taskStatus: "completed" },
        { msg: "BOT: Launching competitor spider crawl on taxcalculator.org...", class: "terminal-action-msg", progress: 25, task: "keywords", taskStatus: "active" },
        { msg: "BOT: Competitor semantic analysis: identified high keyword density for '1099 freelancer tax deduction'.", class: "terminal-info-msg", progress: 30, task: "keywords" },
        { msg: "BOT: Discovered major structural gap: Competitor lacks structured FAQ schema.", class: "terminal-success-msg", progress: 35, task: "keywords" },
        { msg: "SUCCESS: Competitor keyword target mapping complete. Preparing local landing page architectures.", class: "terminal-success-msg", progress: 40, task: "keywords", taskStatus: "completed" },
        { msg: "AI WRITER: Drafting landing page content structures. Focus: Gig-Economy Freelancers.", class: "terminal-info-msg", progress: 45, task: "writing", taskStatus: "active" },
        { msg: "AI WRITER: Generated 2,800 words of premium finance copy, tax FAQs, and dynamic step guides.", class: "terminal-action-msg", progress: 50, task: "writing" },
        { msg: "AI DEVELOPER: Generating interactive mathematics calculation script (javascript tax calculator matrix)...", class: "terminal-info-msg", progress: 55, task: "writing" },
        { msg: "AI DEVELOPER: Generated glowing Obsidian slate-dark UI template.", class: "terminal-success-msg", progress: 60, task: "writing", taskStatus: "completed" },
        { msg: "DEPLOYER: Connecting to 172.30.3.206:22 via secure SFTP tunnel...", class: "terminal-action-msg", progress: 65, task: "deploy", taskStatus: "active" },
        { msg: "DEPLOYER: Creating directory structure: /var/www/html/taxes/self-employed-tax-calculator-2026/...", class: "terminal-action-msg", progress: 70, task: "deploy" },
        { msg: "DEPLOYER: Uploading index.html, style.css, and app.js. Verified permissions: 644.", class: "terminal-success-msg", progress: 75, task: "deploy" },
        { msg: "DEPLOYER: Rewriting Nginx site router configs for SEO-friendly URLs. Reloaded Nginx.", class: "terminal-action-msg", progress: 80, task: "deploy", taskStatus: "completed" },
        { msg: "INDEXER: Re-generating sitemap.xml with new landing page locations.", class: "terminal-info-msg", progress: 82, task: "index", taskStatus: "active" },
        { msg: "INDEXER: Sitemaps uploaded. Pinging Google Search Index API...", class: "terminal-action-msg", progress: 86, task: "index" },
        { msg: "SUCCESS: Google Indexing API handshake OK. Page /taxes/self-employed-tax-calculator-2026 requested for instant crawling.", class: "terminal-success-msg", progress: 90, task: "index", taskStatus: "completed" },
        { msg: "OFFPAGE: Launching competitor backlink scanners on CommonCrawl index databases...", class: "terminal-action-msg", progress: 92, task: "offpage", taskStatus: "active", backlinks_count: 0 },
        { msg: "OFFPAGE: Scanning partner network Web 2.0 channels. Query matches: Medium, Reddit, Google Sites.", class: "terminal-info-msg", progress: 94, task: "offpage", backlinks_count: 0 },
        { msg: "PLAYWRIGHT: Medium blog post published successfully.", class: "terminal-success-msg", progress: 96, task: "offpage", backlinks_count: 1 },
        { msg: "PLAYWRIGHT: Reddit authority link published successfully.", class: "terminal-success-msg", progress: 98, task: "offpage", backlinks_count: 2 },
        { msg: "PLAYWRIGHT: Google Sites backlink node indexed successfully.", class: "terminal-success-msg", progress: 99, task: "offpage", backlinks_count: 3 },
        { msg: "CAMPAIGN COMPLETE: All target SEO tasks executed successfully. 3 authority backlinks built.", class: "terminal-success-msg", progress: 100, task: "offpage", taskStatus: "completed", backlinks_count: 3 }
    ];

    function simulateBotStep() {
        if (logIndex >= botLogs.length) {
            addTerminalLog("[SYSTEM] Campaign tasks completed. Bot entering passive indexation monitoring state.", "terminal-success-msg");
            clearInterval(botInterval);
            botStatusText.textContent = "TASKS DONE";
            botPulse.className = "status-indicator idle";
            botRunning = false;
            botToggle.checked = false;
            
            // Sync status in list
            const item = campaignsList.find(c => c.id === selectedCampaignId);
            const mockLeads = [
                {
                    "domain": comp1Url.textContent || "https://competitor1.com",
                    "email": `contact@${(comp1Name.textContent || "competitor1").replace(/\s+/g, "").toLowerCase()}`,
                    "phone": "+1-555-0199",
                    "linkedin": "https://linkedin.com/company/competitor-one",
                    "twitter": "https://twitter.com/competitor_one"
                },
                {
                    "domain": comp2Url.textContent || "https://competitor2.com",
                    "email": `info@${(comp2Name.textContent || "competitor2").replace(/\s+/g, "").toLowerCase()}`,
                    "phone": "+1-555-0244",
                    "linkedin": "https://linkedin.com/company/competitor-two",
                    "twitter": "https://twitter.com/competitor_two"
                }
            ];
            if (item) {
                item.status = 'completed';
                item.progress = 100;
                item.scraped_leads = mockLeads;
                renderCampaignsSidebar();
            }
            renderLeads(mockLeads);
            saveState();
            return;
        }

        const log = botLogs[logIndex];
        currentProgress = log.progress;
        
        // Mock live artifact feed in simulation mode
        if (currentProgress === 60) {
            const mockHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Obsidian Slate Dark Tax Calculator</title>
    <style>
        body { background: #0f1115; color: #f3f4f6; font-family: sans-serif; text-align: center; padding: 40px 20px; }
        .calc-card { background: rgba(22, 26, 33, 0.75); border: 1px solid rgba(0, 245, 160, 0.25); padding: 30px; border-radius: 12px; max-width: 450px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        h2 { color: #00f5a0; margin-top: 0; }
        input { width: 100%; padding: 12px; margin: 10px 0; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 6px; box-sizing: border-box; }
        button { width: 100%; background: #00f5a0; color: #000; font-weight: bold; border: none; padding: 12px; border-radius: 6px; cursor: pointer; transition: all 0.3s; }
        button:hover { background: #00d285; box-shadow: 0 0 15px rgba(0, 245, 160, 0.4); }
        .res-box { margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 6px; text-align: left; }
    </style>
</head>
<body>
    <div class="calc-card">
        <h2>Freelancer Tax Calculator 2026</h2>
        <input type="number" id="income" placeholder="Gross Income" value="95000">
        <button id="btn">Calculate 2026 Estimated Tax</button>
        <div class="res-box">
            <p>Net Schedule C: $80,000</p>
            <p>SE Tax Estimate: $11,304</p>
            <p>Total Estimated Tax: $19,754</p>
        </div>
    </div>
</body>
</html>`;
            const codeViewEle = document.getElementById('live-code-view');
            const renderFrameEle = document.getElementById('live-render-frame');
            if (codeViewEle && renderFrameEle) {
                codeViewEle.textContent = mockHTML;
                renderFrameEle.srcdoc = mockHTML;
            }
        }
        
        if (log.tech_stack !== undefined) {
            updateTechStackUI(log.tech_stack);
            const item = campaignsList.find(c => c.id === selectedCampaignId);
            if (item) {
                item.tech_stack = log.tech_stack;
            }
        }

        pipelinePercentText.textContent = `${currentProgress}%`;
        pipelineProgressBar.style.width = `${currentProgress}%`;

        if (log.task && log.taskStatus) {
            const currentTask = tasks[log.task];
            if (log.taskStatus === "active") {
                currentTask.item.className = "task-item active";
                currentTask.badge.textContent = "Running";
            } else if (log.taskStatus === "completed") {
                currentTask.item.className = "task-item completed";
                currentTask.badge.textContent = "Done";
                currentTask.item.querySelector('.task-status-icon').innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
            }
        }

        addTerminalLog(`[${new Date().toLocaleTimeString()}] ${log.msg}`, log.class);
        
        // Sync progress in sidebar list
        const item = campaignsList.find(c => c.id === selectedCampaignId);
        if (item) {
            item.progress = currentProgress;
            if (log.tech_stack !== undefined) {
                item.tech_stack = log.tech_stack;
            }
            renderCampaignsSidebar();
        }
        
        // Check for Audit-Only Mode simulation termination
        if (auditOnlyToggle && auditOnlyToggle.checked && logIndex === 10) {
            addTerminalLog(`[${new Date().toLocaleTimeString()}] [SYSTEM] [SIMULATION] Audit-only check complete. Bypassing remaining steps.`, "terminal-success-msg");
            
            // Set progress to 100%
            currentProgress = 100;
            pipelinePercentText.textContent = `100%`;
            pipelineProgressBar.style.width = `100%`;
            
            // Mark other tasks as bypassed (completed)
            const bypassTasks = ['writing', 'deploy', 'index', 'offpage'];
            bypassTasks.forEach(taskKey => {
                const t = tasks[taskKey];
                if (t) {
                    t.item.className = "task-item completed";
                    t.badge.textContent = "Bypassed";
                    t.item.querySelector('.task-status-icon').innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
                }
            });
            
            clearInterval(botInterval);
            botStatusText.textContent = "TASKS DONE";
            botPulse.className = "status-indicator idle";
            botRunning = false;
            botToggle.checked = false;
            
            if (item) {
                item.status = 'completed';
                item.progress = 100;
                renderCampaignsSidebar();
            }
            saveState();
            return;
        }

        logIndex++;
        saveState();
    }

    function addTerminalLog(message, className) {
        const line = document.createElement('span');
        line.className = className;
        line.textContent = message;
        terminalOutput.appendChild(line);
        while (terminalOutput.children.length > 200) {
            terminalOutput.removeChild(terminalOutput.firstChild);
        }
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    // 5. Sidebar Campaigns Orchestration
    function fetchCampaigns() {
        if (!isLiveMode) {
            // Keep simulation campaigns intact in list
            renderCampaignsSidebar();
            return;
        }

        fetch('/api/campaigns')
            .then(res => res.json())
            .then(data => {
                campaignsList = data;
                renderCampaignsSidebar();
                
                // Restore selection if this is the first load
                if (isFirstLoad && selectedCampaignId && !String(selectedCampaignId).startsWith('sim_')) {
                    isFirstLoad = false;
                    selectCampaign(selectedCampaignId);
                } else if (isFirstLoad) {
                    isFirstLoad = false;
                }
            })
            .catch(err => console.error("Error loading campaigns:", err));
    }

    function renderCampaignsSidebar() {
        campaignListWrapper.innerHTML = '';
        if (campaignsList.length === 0) {
            campaignListWrapper.innerHTML = `<div style="color:var(--text-muted); font-size:0.75rem; text-align:center; padding:10px;">No campaigns found.</div>`;
            return;
        }

        campaignsList.forEach(camp => {
            const isActive = selectedCampaignId !== null && String(selectedCampaignId) === String(camp.id);
            const item = document.createElement('div');
            item.className = `campaign-item ${isActive ? 'active' : ''}`;
            item.setAttribute('data-id', camp.id);
            
            item.innerHTML = `
                <div class="campaign-item-header">
                    <span class="campaign-domain" title="${camp.domain}">${camp.domain.replace(/^(https?:\/\/)?(www\.)?/, '')}</span>
                    <span class="campaign-status ${camp.status}">${camp.status}</span>
                </div>
                <div class="campaign-item-progress">
                    <div class="campaign-item-progress-fill" style="width: ${camp.progress}%;"></div>
                </div>
                <div class="campaign-item-details">
                    <span>${camp.progress}% Done</span>
                    <button class="campaign-delete-btn" data-id="${camp.id}" title="Delete Campaign"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            
            // Item selection click handler
            item.addEventListener('click', (e) => {
                if (e.target.closest('.campaign-delete-btn')) return; // Avoid delete trigger
                selectCampaign(camp.id);
            });

            // Delete click handler
            const delBtn = item.querySelector('.campaign-delete-btn');
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete campaign for ${camp.domain}?`)) {
                    deleteCampaign(camp.id);
                }
            });

            campaignListWrapper.appendChild(item);
        });
    }

    function selectCampaign(id) {
        selectedCampaignId = id;
        renderCampaignsSidebar();
        resetCampaignProgress();

        const camp = campaignsList.find(c => String(c.id) === String(id));
        if (!camp) return;

        // Restore configs into form inputs
        targetDomain.value = camp.domain;
        targetKeyword.value = camp.keyword;
        durationSlider.value = camp.duration;
        botPrompt.value = camp.prompt || '';
        if (auditOnlyToggle) {
            auditOnlyToggle.checked = (camp.audit_only === 1 || camp.audit_only === true);
        }
        updateDurationBadge();
        if (camp.comp1_name && camp.comp2_name) {
            updateCompetitorUI(camp.comp1_name, camp.comp1_url, camp.comp2_name, camp.comp2_url);
        } else {
            recalculateCompetitors();
        }

        // Restore scraped leads
        if (String(id).startsWith('sim_')) {
            if (camp.status === 'completed') {
                const mockLeads = [
                    {
                        "domain": comp1Url.textContent || "https://competitor1.com",
                        "email": `contact@${(comp1Name.textContent || "competitor1").replace(/\s+/g, "").toLowerCase()}`,
                        "phone": "+1-555-0199",
                        "linkedin": "https://linkedin.com/company/competitor-one",
                        "twitter": "https://twitter.com/competitor_one"
                    },
                    {
                        "domain": comp2Url.textContent || "https://competitor2.com",
                        "email": `info@${(comp2Name.textContent || "competitor2").replace(/\s+/g, "").toLowerCase()}`,
                        "phone": "+1-555-0244",
                        "linkedin": "https://linkedin.com/company/competitor-two",
                        "twitter": "https://twitter.com/competitor_two"
                    }
                ];
                renderLeads(mockLeads);
            } else {
                renderLeads(camp.scraped_leads || []);
            }
        } else {
            renderLeads(camp.scraped_leads || []);
        }

        // Restore backlinks count badge and tech stack badge
        const backlinksCountText = document.getElementById('backlinks-count-text');
        if (backlinksCountText) {
            backlinksCountText.textContent = `${camp.backlinks_count || 0} Backlinks Built`;
        }
        updateTechStackUI(camp.tech_stack);

        if (camp.artifact_html) {
            const codeView = document.getElementById('live-code-view');
            const renderFrame = document.getElementById('live-render-frame');
            if (codeView && renderFrame) {
                codeView.textContent = camp.artifact_html;
                renderFrame.srcdoc = camp.artifact_html;
            }
        }

        if (String(id).startsWith('sim_')) {
            // Local simulation state load
            isLiveMode = false;
            envModeBadge.className = "environment-badge simulation";
            envModeBadge.innerHTML = `<i class="fa-solid fa-flask"></i> <span>SIMULATION MODE</span>`;
            
            currentProgress = camp.progress;
            pipelinePercentText.textContent = `${currentProgress}%`;
            pipelineProgressBar.style.width = `${currentProgress}%`;
            restoreTaskUIStates();

            // Dump simulated logs
            const limit = Math.floor(currentProgress / 5);
            for (let i = 0; i < limit; i++) {
                if (botLogs[i]) {
                    addTerminalLog(`[SIMULATION] ${botLogs[i].msg}`, botLogs[i].class);
                }
            }
            logIndex = limit;

            if (camp.status === 'running') {
                botRunning = true;
                botToggle.checked = true;
                botPulse.className = "status-indicator running";
                botStatusText.textContent = "BOT ENGAGED";
                engageStatusLabel.textContent = "BOT ACTIVE";
                engageStatusLabel.style.color = "var(--neon-green)";
                liveIndicator.className = "terminal-badge pulse-green";
                liveIndicator.textContent = "RUNNING";
                
                clearInterval(botInterval);
                botInterval = setInterval(simulateBotStep, 1500);
            } else {
                botRunning = false;
                botToggle.checked = false;
                botPulse.className = "status-indicator idle";
                botStatusText.textContent = camp.status === 'completed' ? "TASKS DONE" : "SYSTEM STANDBY";
                engageStatusLabel.textContent = "ENGAGE BOT";
                engageStatusLabel.style.color = "var(--text-secondary)";
                liveIndicator.className = "terminal-badge pulse-red";
                liveIndicator.textContent = "STANDBY";
            }
        } else {
            // Live Server campaign state load
            isLiveMode = true;
            envModeBadge.className = "environment-badge live";
            envModeBadge.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> <span>LIVE RUN ACTIVE</span>`;
            
            currentProgress = camp.progress;
            pipelinePercentText.textContent = `${currentProgress}%`;
            pipelineProgressBar.style.width = `${currentProgress}%`;
            restoreTaskUIStates();
            
            if (camp.status === 'running' || camp.status === 'monitoring') {
                botRunning = true;
                botToggle.checked = true;
                botPulse.className = "status-indicator running";
                botStatusText.textContent = camp.status === 'monitoring' ? "SEO MONITORING" : "BOT ENGAGED";
                engageStatusLabel.textContent = camp.status === 'monitoring' ? "BOT MONITORING" : "BOT ACTIVE";
                engageStatusLabel.style.color = "var(--neon-green)";
                liveIndicator.className = "terminal-badge pulse-green";
                liveIndicator.textContent = camp.status === 'monitoring' ? "MONITORING" : "RUNNING";
            } else {
                botRunning = false;
                botToggle.checked = false;
                botPulse.className = "status-indicator idle";
                botStatusText.textContent = camp.status === 'completed' ? "TASKS DONE" : "SYSTEM STANDBY";
                engageStatusLabel.textContent = "ENGAGE BOT";
                engageStatusLabel.style.color = "var(--text-secondary)";
                liveIndicator.className = "terminal-badge pulse-red";
                liveIndicator.textContent = "STANDBY";
            }
            
            connectCampaignStream(id);
        }
        saveState();
    }

    function connectCampaignStream(id) {
        if (eventSource) {
            eventSource.close();
        }

        eventSource = new EventSource(`/api/campaigns/${id}/stream`);
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.artifact) {
                const codeView = document.getElementById('live-code-view');
                const renderFrame = document.getElementById('live-render-frame');
                if (codeView && renderFrame) {
                    codeView.textContent = data.artifact;
                    renderFrame.srcdoc = data.artifact;
                }
            }
            
            if (data.tech_stack !== undefined) {
                updateTechStackUI(data.tech_stack);
                const item = campaignsList.find(c => String(c.id) === String(id));
                if (item) {
                    item.tech_stack = data.tech_stack;
                }
            }
            
            if (data.comp1_name !== undefined && data.comp2_name !== undefined) {
                updateCompetitorUI(data.comp1_name, data.comp1_url, data.comp2_name, data.comp2_url);
                const item = campaignsList.find(c => String(c.id) === String(id));
                if (item) {
                    item.comp1_name = data.comp1_name;
                    item.comp1_url = data.comp1_url;
                    item.comp2_name = data.comp2_name;
                    item.comp2_url = data.comp2_url;
                }
            }
            
            if (data.scraped_leads !== undefined) {
                let leads = [];
                try {
                    leads = typeof data.scraped_leads === 'string' ? JSON.parse(data.scraped_leads) : data.scraped_leads;
                } catch(e) {
                    leads = [];
                }
                const item = campaignsList.find(c => String(c.id) === String(id));
                if (item) {
                    item.scraped_leads = leads;
                }
                renderLeads(leads);
            }
            
            if (data.progress !== undefined) {
                currentProgress = data.progress;
                pipelinePercentText.textContent = `${currentProgress}%`;
                pipelineProgressBar.style.width = `${currentProgress}%`;
                restoreTaskUIStates();
                
                // Update backlinks counter if sent
                if (data.backlinks_count !== undefined) {
                    const backlinksCountText = document.getElementById('backlinks-count-text');
                    if (backlinksCountText) {
                        backlinksCountText.textContent = `${data.backlinks_count} Backlinks Built`;
                    }
                }
                
                // Update local list progress values
                const item = campaignsList.find(c => String(c.id) === String(id));
                if (item) {
                    item.progress = currentProgress;
                    if (data.backlinks_count !== undefined) {
                        item.backlinks_count = data.backlinks_count;
                    }
                    renderCampaignsSidebar();
                }
            }
            
            if (data.task && data.taskStatus) {
                const currentTask = tasks[data.task];
                if (currentTask) {
                    if (data.taskStatus === "active") {
                        currentTask.item.className = "task-item active";
                        currentTask.badge.textContent = "Running";
                        currentTask.item.querySelector('.task-status-icon').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
                    } else if (data.taskStatus === "completed") {
                        currentTask.item.className = "task-item completed";
                        currentTask.badge.textContent = "Done";
                        currentTask.item.querySelector('.task-status-icon').innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
                    }
                }
            }
            
            if (data.message) {
                addTerminalLog(data.message, data.class || 'terminal-info-msg');
            }
            
            if (data.status === 'monitoring') {
                addTerminalLog("[SYSTEM] Campaign transitioned to active SEO monitoring state.", "terminal-success-msg");
                botRunning = true;
                botToggle.checked = true;
                botPulse.className = "status-indicator running";
                botStatusText.textContent = "SEO MONITORING";
                engageStatusLabel.textContent = "BOT MONITORING";
                engageStatusLabel.style.color = "var(--neon-green)";
                liveIndicator.className = "terminal-badge pulse-green";
                liveIndicator.textContent = "MONITORING";
                fetchCampaigns();
            }
            
            if (data.status === 'paused') {
                addTerminalLog("[SYSTEM] SEO monitoring paused by user.", "terminal-warning-msg");
                eventSource.close();
                eventSource = null;
                botRunning = false;
                botToggle.checked = false;
                botPulse.className = "status-indicator idle";
                botStatusText.textContent = "SYSTEM STANDBY";
                engageStatusLabel.textContent = "ENGAGE BOT";
                engageStatusLabel.style.color = "var(--text-secondary)";
                liveIndicator.className = "terminal-badge pulse-red";
                liveIndicator.textContent = "STANDBY";
                fetchCampaigns();
            }

            if (data.status === 'failed') {
                addTerminalLog("[SYSTEM] Campaign execution failed.", "terminal-error-msg");
                eventSource.close();
                eventSource = null;
                botRunning = false;
                botToggle.checked = false;
                botPulse.className = "status-indicator idle";
                botStatusText.textContent = "SYSTEM FAILED";
                engageStatusLabel.textContent = "ENGAGE BOT";
                engageStatusLabel.style.color = "var(--text-secondary)";
                liveIndicator.className = "terminal-badge pulse-red";
                liveIndicator.textContent = "STANDBY";
                fetchCampaigns();
            }

            if (data.status === 'completed') {
                addTerminalLog("[SYSTEM] Live campaign tasks completed successfully.", "terminal-success-msg");
                eventSource.close();
                eventSource = null;
                botRunning = false;
                botToggle.checked = false;
                botPulse.className = "status-indicator idle";
                botStatusText.textContent = "TASKS DONE";
                engageStatusLabel.textContent = "ENGAGE BOT";
                engageStatusLabel.style.color = "var(--text-secondary)";
                liveIndicator.className = "terminal-badge pulse-red";
                liveIndicator.textContent = "STANDBY";
                fetchCampaigns();
            }
            saveState();
        };
        
        eventSource.onerror = () => {
            // Silently close on completion or disconnect
            eventSource.close();
        };
    }

    function deleteCampaign(id) {
        if (String(id).startsWith('sim_')) {
            campaignsList = campaignsList.filter(c => String(c.id) !== String(id));
            if (String(selectedCampaignId) === String(id)) {
                selectedCampaignId = null;
                resetCampaignProgress();
            }
            renderCampaignsSidebar();
            saveState();
            return;
        }

        fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(() => {
                if (String(selectedCampaignId) === String(id)) {
                    selectedCampaignId = null;
                    resetCampaignProgress();
                }
                fetchCampaigns();
            })
            .catch(err => console.error("Error deleting campaign:", err));
    }

    btnNewCampaign.addEventListener('click', () => {
        // Clear selection to create fresh enqueued parameters
        selectedCampaignId = null;
        renderCampaignsSidebar();
        resetCampaignProgress();
        
        targetDomain.value = 'https://omnicalc.com';
        targetKeyword.value = 'self employed tax calculator 2026';
        durationSlider.value = 3;
        botPrompt.value = 'Focus heavily on gig-economy freelancers, write with an authoritative but simple financial tone, build a glowing Obsidian Dark tax calculator interface, and embed our currency widgets naturally to earn backlinks.';
        
        updateDurationBadge();
        recalculateCompetitors();
        
        addTerminalLog("[SYSTEM] Standby. Configure settings above and click ENGAGE BOT to start a new campaign.", "terminal-system-msg");
        saveState();
    });

    // 6. Floating AI Chatbot Widget Interaction
    function initChatbot() {
        chatbotToggleBtn.addEventListener('click', () => {
            chatbotWidget.classList.toggle('open');
            chatNotificationBadge.style.display = 'none';
            // Scroll to bottom
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        });

        chatCloseBtn.addEventListener('click', () => {
            chatbotWidget.classList.remove('open');
        });

        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const msg = chatUserInput.value.trim();
            if (!msg) return;

            // Render user message
            appendChatMessage(msg, 'user');
            chatUserInput.value = '';

            // Render Loader
            const loader = appendChatLoader();

            // Call Chatbot API
            fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    campaign_id: selectedCampaignId && !String(selectedCampaignId).startsWith('sim_') ? selectedCampaignId : null,
                    free_mode: chatFreeMode.checked,
                    api: {
                        llm_provider: llmProvider.value,
                        llm_model: llmModel.value,
                        llm_api_key: llmApiKey.value
                    }
                })
            })
            .then(res => res.json())
            .then(data => {
                loader.remove();
                if (data.status === 'success') {
                    appendChatMessage(data.reply, 'bot');
                } else {
                    appendChatMessage(`Error: ${data.message}`, 'bot');
                }
            })
            .catch(err => {
                loader.remove();
                appendChatMessage(`Connection failed: ${err.message}`, 'bot');
            });
        });
    }

    function appendChatMessage(text, sender) {
        const msg = document.createElement('div');
        msg.className = `chat-message ${sender}`;
        msg.innerHTML = `<div class="message-content">${text}</div>`;
        chatMessagesContainer.appendChild(msg);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        
        // Show badge if chat is closed and bot replied
        if (sender === 'bot' && !chatbotWidget.classList.contains('open')) {
            chatNotificationBadge.style.display = 'flex';
        }
    }

    function appendChatLoader() {
        const loader = document.createElement('div');
        loader.className = 'chat-message-loader';
        loader.innerHTML = '<span></span><span></span><span></span>';
        chatMessagesContainer.appendChild(loader);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        return loader;
    }

    // Initialize chatbot controls
    initChatbot();

    // 7. State Persistence Loading
    function saveState() {
        if (isHydrating) return;
        try {
            localStorage.setItem('omniseo_domain', targetDomain.value);
            localStorage.setItem('omniseo_keyword', targetKeyword.value);
            localStorage.setItem('omniseo_duration', durationSlider.value);
            localStorage.setItem('omniseo_prompt', botPrompt.value);
            localStorage.setItem('omniseo_host_ip', hostIp.value);
            localStorage.setItem('omniseo_host_user', hostUser.value);
            localStorage.setItem('omniseo_host_port', document.getElementById('host-port').value);
            localStorage.setItem('omniseo_host_pass', document.getElementById('host-pass').value);
            localStorage.setItem('omniseo_host_protocol', hostProtocol ? hostProtocol.value : 'sftp');
            localStorage.setItem('omniseo_live_mode', isLiveMode);
            localStorage.setItem('omniseo_selected_id', selectedCampaignId || '');
            
            localStorage.setItem('omniseo_llm_provider', llmProvider.value);
            localStorage.setItem('omniseo_llm_model', llmModel.value);
            localStorage.setItem('omniseo_llm_api_key', llmApiKey.value);
            localStorage.setItem('omniseo_apify_token', apifyToken.value);
            localStorage.setItem('omniseo_audit_only', auditOnlyToggle ? auditOnlyToggle.checked : 'false');
        } catch (e) {
            console.error("Error saving state:", e);
        }
    }

    function restoreTaskUIStates() {
        const taskKeys = ['audit', 'keywords', 'writing', 'deploy', 'index', 'offpage'];
        const isAuditOnly = auditOnlyToggle ? auditOnlyToggle.checked : false;
        
        taskKeys.forEach((key) => {
            const task = tasks[key];
            if (!task) return;
            
            if (isAuditOnly && ['writing', 'deploy', 'index', 'offpage'].includes(key)) {
                if (currentProgress >= 40) {
                    task.item.className = "task-item completed";
                    task.badge.textContent = "Bypassed";
                    task.item.querySelector('.task-status-icon').innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
                } else {
                    task.item.className = "task-item pending";
                    task.badge.textContent = "Pending";
                    task.item.querySelector('.task-status-icon').innerHTML = `<i class="fa-solid fa-spinner"></i>`;
                }
            } else {
                let taskProgressStart = 0;
                let taskProgressEnd = 0;
                if (key === 'audit') { taskProgressStart = 0; taskProgressEnd = 20; }
                else if (key === 'keywords') { taskProgressStart = 20; taskProgressEnd = 40; }
                else if (key === 'writing') { taskProgressStart = 40; taskProgressEnd = 60; }
                else if (key === 'deploy') { taskProgressStart = 60; taskProgressEnd = 80; }
                else if (key === 'index') { taskProgressStart = 80; taskProgressEnd = 90; }
                else if (key === 'offpage') { taskProgressStart = 90; taskProgressEnd = 100; }

                if (currentProgress >= taskProgressEnd) {
                    task.item.className = "task-item completed";
                    task.badge.textContent = "Done";
                    task.item.querySelector('.task-status-icon').innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
                } else if (currentProgress > taskProgressStart && currentProgress < taskProgressEnd) {
                    task.item.className = "task-item active";
                    task.badge.textContent = "Running";
                    task.item.querySelector('.task-status-icon').innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
                } else {
                    task.item.className = "task-item pending";
                    task.badge.textContent = "Pending";
                    task.item.querySelector('.task-status-icon').innerHTML = `<i class="fa-solid fa-spinner"></i>`;
                }
            }
        });
    }

    function loadState() {
        try {
            if (localStorage.getItem('omniseo_domain') !== null) {
                targetDomain.value = localStorage.getItem('omniseo_domain');
                const event = new Event('input');
                targetDomain.dispatchEvent(event);
            }
            if (localStorage.getItem('omniseo_keyword') !== null) {
                targetKeyword.value = localStorage.getItem('omniseo_keyword');
                const event = new Event('input');
                targetKeyword.dispatchEvent(event);
            }
            if (localStorage.getItem('omniseo_duration') !== null) {
                durationSlider.value = localStorage.getItem('omniseo_duration');
                updateDurationBadge();
            }
            if (localStorage.getItem('omniseo_prompt') !== null) {
                botPrompt.value = localStorage.getItem('omniseo_prompt');
            }
            if (localStorage.getItem('omniseo_host_ip') !== null) {
                hostIp.value = localStorage.getItem('omniseo_host_ip');
            }
            if (localStorage.getItem('omniseo_host_user') !== null) {
                hostUser.value = localStorage.getItem('omniseo_host_user');
            }
            if (localStorage.getItem('omniseo_host_port') !== null) {
                document.getElementById('host-port').value = localStorage.getItem('omniseo_host_port');
            }
            if (localStorage.getItem('omniseo_host_pass') !== null) {
                document.getElementById('host-pass').value = localStorage.getItem('omniseo_host_pass');
            }
            if (localStorage.getItem('omniseo_host_protocol') !== null && hostProtocol) {
                hostProtocol.value = localStorage.getItem('omniseo_host_protocol');
            }
            
            if (localStorage.getItem('omniseo_live_mode') !== null) {
                isLiveMode = localStorage.getItem('omniseo_live_mode') === 'true';
                if (isLiveMode) {
                    envModeBadge.className = "environment-badge live";
                    envModeBadge.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> <span>LIVE RUN ACTIVE</span>`;
                } else {
                    envModeBadge.className = "environment-badge simulation";
                    envModeBadge.innerHTML = `<i class="fa-solid fa-flask"></i> <span>SIMULATION MODE</span>`;
                }
            }

            if (localStorage.getItem('omniseo_llm_provider') !== null) {
                llmProvider.value = localStorage.getItem('omniseo_llm_provider');
                const event = new Event('change');
                llmProvider.dispatchEvent(event);
            }
            if (localStorage.getItem('omniseo_llm_model') !== null) {
                llmModel.value = localStorage.getItem('omniseo_llm_model');
            }
            if (localStorage.getItem('omniseo_llm_api_key') !== null) {
                llmApiKey.value = localStorage.getItem('omniseo_llm_api_key');
            }
            if (localStorage.getItem('omniseo_apify_token') !== null) {
                apifyToken.value = localStorage.getItem('omniseo_apify_token');
            }
            if (localStorage.getItem('omniseo_audit_only') !== null && auditOnlyToggle) {
                auditOnlyToggle.checked = localStorage.getItem('omniseo_audit_only') === 'true';
            }
            if (auditOnlyToggle) {
                auditOnlyToggle.addEventListener('change', saveState);
            }

            selectedCampaignId = localStorage.getItem('omniseo_selected_id') || null;

            // Fetch and set up list
            fetchCampaigns();
            
            // Poll for dynamic backend updates every 4 seconds to sync lists
            setInterval(() => {
                if (isLiveMode) {
                    fetch('/api/campaigns')
                        .then(res => res.json())
                        .then(data => {
                            campaignsList = data;
                            renderCampaignsSidebar();
                        })
                        .catch(err => console.log(err));
                }
            }, 4000);

        } catch (e) {
            console.error("Error loading state:", e);
        }
    }

    // Initialize UI Settings
    try {
        isHydrating = true;
        updateDurationBadge();
        recalculateCompetitors();
        loadState();
    } catch (e) {
        console.error("Hydration failed during initialization:", e);
    } finally {
        isHydrating = false;
    }

    // Live preview tab switcher
    const tabBtnRender = document.getElementById('tab-btn-render');
    const tabBtnCode = document.getElementById('tab-btn-code');
    const paneRender = document.getElementById('pane-render');
    const paneCode = document.getElementById('pane-code');

    if (tabBtnRender && tabBtnCode) {
        tabBtnRender.addEventListener('click', () => {
            tabBtnRender.classList.add('active');
            tabBtnCode.classList.remove('active');
            paneRender.classList.add('active');
            paneCode.classList.remove('active');
        });

        tabBtnCode.addEventListener('click', () => {
            tabBtnCode.classList.add('active');
            tabBtnRender.classList.remove('active');
            paneCode.classList.add('active');
            paneRender.classList.remove('active');
        });
    }

    // Attach change/input listeners to auto-save
    targetDomain.addEventListener('change', saveState);
    targetKeyword.addEventListener('change', saveState);
    botPrompt.addEventListener('change', saveState);
    hostIp.addEventListener('change', saveState);
    hostUser.addEventListener('change', saveState);
    document.getElementById('host-port').addEventListener('change', saveState);
    document.getElementById('host-pass').addEventListener('change', saveState);
    
    llmProvider.addEventListener('change', saveState);
    llmModel.addEventListener('change', saveState);
    llmApiKey.addEventListener('change', saveState);
    apifyToken.addEventListener('change', saveState);

    // Sidebar Navigation Scroll handlers
    const mainContent = document.querySelector('.main-content');
    const navDashboard = document.getElementById('nav-dashboard');
    const navCredentials = document.getElementById('nav-credentials');
    const navCompetitors = document.getElementById('nav-competitors');
    const navLogs = document.getElementById('nav-logs');

    function scrollToSection(targetId) {
        const target = document.getElementById(targetId);
        if (target && mainContent) {
            const containerRect = mainContent.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const relativeTop = targetRect.top - containerRect.top + mainContent.scrollTop;
            mainContent.scrollTo({
                top: relativeTop - 20,
                behavior: 'smooth'
            });
        }
    }

    if (navDashboard) {
        navDashboard.addEventListener('click', (e) => {
            e.preventDefault();
            scrollToSection('config-module');
        });
    }

    if (navCredentials) {
        navCredentials.addEventListener('click', (e) => {
            e.preventDefault();
            scrollToSection('hosting-module');
        });
    }

    if (navCompetitors) {
        navCompetitors.addEventListener('click', (e) => {
            e.preventDefault();
            scrollToSection('competitor-module');
        });
    }

    if (navLogs) {
        navLogs.addEventListener('click', (e) => {
            e.preventDefault();
            scrollToSection('console-module');
        });
    }

    // Scrollspy to automatically highlight active sidebar nav items
    if (mainContent) {
        mainContent.addEventListener('scroll', () => {
            const sections = [
                { id: 'config-module', link: navDashboard },
                { id: 'hosting-module', link: navCredentials },
                { id: 'competitor-module', link: navCompetitors },
                { id: 'console-module', link: navLogs }
            ];

            const containerRect = mainContent.getBoundingClientRect();
            let activeSection = null;

            for (const section of sections) {
                const element = document.getElementById(section.id);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    const relativeTop = rect.top - containerRect.top;
                    if (relativeTop <= 100) {
                        activeSection = section;
                    }
                }
            }

            if (!activeSection) {
                activeSection = sections[0];
            }

            sections.forEach(section => {
                if (section.link) {
                    if (section.link === activeSection.link) {
                        section.link.classList.add('active');
                    } else {
                        section.link.classList.remove('active');
                    }
                }
            });
        });
    }
});
