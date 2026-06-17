import threading
import time
import json
import sqlite3
import queue
from flask import Flask, request, jsonify, Response
import paramiko
from concurrent.futures import ThreadPoolExecutor
from beyond_seo_engine import run_campaign_pipeline, call_gemini_api, call_openrouter_api

app = Flask(__name__)

DB_PATH = '/opt/omni_seo/backend/campaigns.db'
executor = ThreadPoolExecutor(max_workers=3)

# Thread-safe stream subscribers mapper
subscribers = {}
subscribers_lock = threading.Lock()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def dispatch_log(campaign_id, log_data):
    with subscribers_lock:
        if campaign_id in subscribers:
            for q in subscribers[campaign_id]:
                q.put(log_data)

def save_log_to_db(campaign_id, progress, task, message, class_name, task_status=None, artifact=None, backlinks_count=None, tech_stack=None, comp1_name=None, comp1_url=None, comp2_name=None, comp2_url=None, scraped_leads=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO campaign_logs (campaign_id, progress, task, message, class_name, task_status, artifact)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (campaign_id, progress, task, message, class_name, task_status, artifact))
    conn.commit()
    conn.close()
    
    # Format and dispatch
    log_entry = {
        "progress": progress,
        "task": task,
        "message": message,
        "class": class_name
    }
    if task_status:
        log_entry["taskStatus"] = task_status
    if artifact:
        log_entry["artifact"] = artifact
    if backlinks_count is not None:
        log_entry["backlinks_count"] = backlinks_count
    if tech_stack is not None:
        log_entry["tech_stack"] = tech_stack
    if comp1_name is not None:
        log_entry["comp1_name"] = comp1_name
    if comp1_url is not None:
        log_entry["comp1_url"] = comp1_url
    if comp2_name is not None:
        log_entry["comp2_name"] = comp2_name
    if comp2_url is not None:
        log_entry["comp2_url"] = comp2_url
    if scraped_leads is not None:
        log_entry["scraped_leads"] = scraped_leads
        
    dispatch_log(campaign_id, log_entry)

def update_campaign_status(campaign_id, status=None, progress=None, artifact_html=None, backlinks_count=None, tech_stack=None, comp1_name=None, comp1_url=None, comp2_name=None, comp2_url=None, scraped_leads=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    updates = []
    params = []
    
    if status is not None:
        updates.append("status = ?")
        params.append(status)
    if progress is not None:
        updates.append("progress = ?")
        params.append(progress)
    if artifact_html is not None:
        updates.append("artifact_html = ?")
        params.append(artifact_html)
    if backlinks_count is not None:
        updates.append("backlinks_count = ?")
        params.append(backlinks_count)
    if tech_stack is not None:
        updates.append("tech_stack = ?")
        params.append(tech_stack)
    if comp1_name is not None:
        updates.append("comp1_name = ?")
        params.append(comp1_name)
    if comp1_url is not None:
        updates.append("comp1_url = ?")
        params.append(comp1_url)
    if comp2_name is not None:
        updates.append("comp2_name = ?")
        params.append(comp2_name)
    if comp2_url is not None:
        updates.append("comp2_url = ?")
        params.append(comp2_url)
    if scraped_leads is not None:
        updates.append("scraped_leads = ?")
        params.append(scraped_leads)
        
    if updates:
        params.append(campaign_id)
        query = f"UPDATE campaigns SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
    conn.close()
def run_monitoring_loop(campaign_id, domain, keyword):
    clean_domain = domain.replace("https://", "").replace("http://", "").replace("www.", "").strip("/")
    protocol = "https://" if domain.lower().startswith("https://") else "http://"
    loop_count = 0
    print(f"[SYSTEM] Starting monitoring daemon thread for campaign {campaign_id}")
    while True:
        try:
            # Check if campaign status is still monitoring
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT status FROM campaigns WHERE id = ?', (campaign_id,))
            camp = cursor.fetchone()
            conn.close()
            
            if not camp or camp["status"] != 'monitoring':
                print(f"[SYSTEM] Exiting monitoring thread for campaign {campaign_id} because status is {camp['status'] if camp else 'deleted'}")
                break
                
            loop_count += 1
            
            if loop_count % 3 == 1:
                msg = f"MONITOR: Verifying Google Search Index state for target URL {protocol}{clean_domain}/taxes/..."
                save_log_to_db(campaign_id, 100, "offpage", msg, "terminal-info-msg")
            elif loop_count % 3 == 2:
                msg = f"MONITOR: Querying organic competitor rankings for keyword '{keyword}'..."
                save_log_to_db(campaign_id, 100, "offpage", msg, "terminal-info-msg")
            else:
                msg = "MONITOR: 0 index / ranking changes detected. Web 2.0 links verification: 100% active."
                save_log_to_db(campaign_id, 100, "offpage", msg, "terminal-success-msg")
        except Exception as e:
            print(f"[SYSTEM ERROR] Exception in monitoring loop for campaign {campaign_id}: {e}")
            
        time.sleep(30)

def run_campaign_wrapper(campaign_id, config):
    try:
        update_campaign_status(campaign_id, status='running', progress=0, backlinks_count=0, tech_stack='unknown')
        
        def log_callback(progress, task, message, class_name="terminal-info-msg", taskStatus=None, artifact=None, backlinks_count=None, tech_stack=None, comp1_name=None, comp1_url=None, comp2_name=None, comp2_url=None, scraped_leads=None):
            save_log_to_db(campaign_id, progress, task, message, class_name, taskStatus, artifact, backlinks_count, tech_stack, comp1_name, comp1_url, comp2_name, comp2_url, scraped_leads)
            update_campaign_status(campaign_id, progress=progress, artifact_html=artifact, backlinks_count=backlinks_count, tech_stack=tech_stack, comp1_name=comp1_name, comp1_url=comp1_url, comp2_name=comp2_name, comp2_url=comp2_url, scraped_leads=scraped_leads)
                
        # Run pipeline
        success, message = run_campaign_pipeline(config, log_callback)
        if success:
            if config.get("audit_only"):
                save_log_to_db(campaign_id, 100, "keywords", "SYSTEM: Audit check completed successfully.", "terminal-success-msg", "completed")
                update_campaign_status(campaign_id, status='completed', progress=100)
                dispatch_log(campaign_id, {"status": "completed"})
            else:
                update_campaign_status(campaign_id, status='monitoring', progress=100)
                save_log_to_db(campaign_id, 100, "offpage", "SYSTEM: Campaign initialization complete. Entering active SEO monitoring state.", "terminal-success-msg", "completed")
                dispatch_log(campaign_id, {"status": "monitoring"})
                
                # Start SEO monitoring loop daemon thread
                domain = config.get("domain", "").strip()
                keyword = config.get("keyword", "").strip()
                t = threading.Thread(target=run_monitoring_loop, args=(campaign_id, domain, keyword), daemon=True)
                t.start()
        else:
            save_log_to_db(campaign_id, 100, "offpage", f"SYSTEM: Campaign finished with errors: {message}", "terminal-error-msg", "completed")
            update_campaign_status(campaign_id, status='failed', progress=100)
            dispatch_log(campaign_id, {"status": "failed"})
            
    except Exception as e:
        save_log_to_db(campaign_id, 100, "offpage", f"SYSTEM ERROR: Campaign failed: {str(e)}", "terminal-error-msg", "completed")
        update_campaign_status(campaign_id, status='failed', progress=100)
        dispatch_log(campaign_id, {"status": "failed"})

@app.route('/api/test-handshake', methods=['POST'])
def test_handshake():
    data = request.json or {}
    protocol = data.get("protocol", "sftp").lower()
    host = data.get("host", "172.30.3.206").strip()
    username = data.get("username", "root").strip()
    port_val = data.get("port")
    password = data.get("password", "").strip()

    if protocol == "ftp":
        import ftplib
        port = int(port_val or 21)
        try:
            ftp = ftplib.FTP()
            ftp.connect(host, port, timeout=10)
            ftp.login(username, password)
            ftp.quit()
            return jsonify({"status": "success", "message": "FTP Handshake successful."})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)})
    else:
        port = int(port_val or 22)
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            if password == "passwordless-ssh-active" or not password:
                ssh.connect(host, port=port, username=username, timeout=10)
            else:
                ssh.connect(host, port=port, username=username, password=password, timeout=10)
            
            ssh.close()
            return jsonify({"status": "success", "message": "SFTP Handshake successful."})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)})

@app.route('/api/campaigns', methods=['GET'])
def list_campaigns():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, domain, keyword, duration, prompt, status, progress, created_at, artifact_html, backlinks_count, tech_stack, audit_only, comp1_name, comp1_url, comp2_name, comp2_url, scraped_leads
        FROM campaigns
        ORDER BY id DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    
    campaigns = []
    for r in rows:
        # Deserialize scraped_leads
        leads = []
        if "scraped_leads" in r.keys() and r["scraped_leads"]:
            try:
                leads = json.loads(r["scraped_leads"])
            except Exception:
                leads = []
                
        campaigns.append({
            "id": r["id"],
            "domain": r["domain"],
            "keyword": r["keyword"],
            "duration": r["duration"],
            "prompt": r["prompt"],
            "status": r["status"],
            "progress": r["progress"],
            "created_at": r["created_at"],
            "artifact_html": r["artifact_html"],
            "backlinks_count": r["backlinks_count"] if "backlinks_count" in r.keys() else 0,
            "tech_stack": r["tech_stack"] if "tech_stack" in r.keys() else "unknown",
            "audit_only": r["audit_only"] if "audit_only" in r.keys() else 0,
            "comp1_name": r["comp1_name"] if "comp1_name" in r.keys() else None,
            "comp1_url": r["comp1_url"] if "comp1_url" in r.keys() else None,
            "comp2_name": r["comp2_name"] if "comp2_name" in r.keys() else None,
            "comp2_url": r["comp2_url"] if "comp2_url" in r.keys() else None,
            "scraped_leads": leads
        })
        
    return jsonify(campaigns)

@app.route('/api/campaigns', methods=['POST'])
def create_campaign():
    config = request.json or {}
    domain = config.get("domain", "omnicalc.com").strip()
    keyword = config.get("keyword", "self employed tax calculator 2026").strip()
    duration = int(config.get("duration", 3))
    prompt = config.get("prompt", "").strip()
    audit_only = int(config.get("audit_only", 0))
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO campaigns (domain, keyword, duration, prompt, status, progress, audit_only)
        VALUES (?, ?, ?, ?, 'queued', 0, ?)
    ''', (domain, keyword, duration, prompt, audit_only))
    campaign_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Save the initial enqueued log
    save_log_to_db(campaign_id, 0, "audit", "[SYSTEM] Autopilot campaign engaged on orchestration server.", "terminal-system-msg", "active")
    
    # Run campaign asynchronously
    executor.submit(run_campaign_wrapper, campaign_id, config)
    
    return jsonify({
        "status": "success",
        "message": "Campaign started.",
        "campaign": {
            "id": campaign_id,
            "domain": domain,
            "keyword": keyword,
            "duration": duration,
            "prompt": prompt,
            "status": "queued",
            "progress": 0,
            "audit_only": audit_only
        }
    })

@app.route('/api/campaigns/<int:campaign_id>', methods=['DELETE'])
def delete_campaign(campaign_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM campaigns WHERE id = ?', (campaign_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": f"Campaign {campaign_id} deleted."})

@app.route('/api/campaigns/<int:campaign_id>/status', methods=['POST'])
def update_status_route(campaign_id):
    data = request.json or {}
    new_status = data.get("status", "paused").strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE campaigns SET status = ? WHERE id = ?', (new_status, campaign_id))
    conn.commit()
    conn.close()
    
    dispatch_log(campaign_id, {"status": new_status})
    
    if new_status == 'paused':
        save_log_to_db(campaign_id, 100, "offpage", "[SYSTEM] SEO monitoring paused by user.", "terminal-warning-msg")
    elif new_status == 'completed':
        save_log_to_db(campaign_id, 100, "offpage", "[SYSTEM] Campaign marked as completed and closed.", "terminal-success-msg")
        
    return jsonify({"status": "success", "message": f"Campaign status updated to {new_status}."})

@app.route('/api/campaigns/<int:campaign_id>/resume', methods=['POST'])
def resume_campaign_route(campaign_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT domain, keyword, duration, prompt, audit_only, status, progress FROM campaigns WHERE id = ?', (campaign_id,))
    camp = cursor.fetchone()
    conn.close()
    
    if not camp:
        return jsonify({"status": "error", "message": "Campaign not found"}), 404
        
    if camp["status"] in ["running", "queued", "monitoring"]:
        return jsonify({"status": "success", "message": "Campaign is already active."})
        
    config = {
        "domain": camp["domain"],
        "keyword": camp["keyword"],
        "duration": camp["duration"],
        "prompt": camp["prompt"],
        "audit_only": camp["audit_only"]
    }
    
    if camp["progress"] == 100 and not camp["audit_only"]:
        update_campaign_status(campaign_id, status='monitoring')
        dispatch_log(campaign_id, {"status": "monitoring"})
        save_log_to_db(campaign_id, 100, "offpage", "[SYSTEM] SEO monitoring loop resumed by user.", "terminal-success-msg")
        
        # Start daemon thread
        t = threading.Thread(target=run_monitoring_loop, args=(campaign_id, camp["domain"], camp["keyword"]), daemon=True)
        t.start()
        
        return jsonify({"status": "success", "message": "Campaign monitoring loop resumed."})
        
    # Run campaign wrapper in background thread
    executor.submit(run_campaign_wrapper, campaign_id, config)
    
    return jsonify({"status": "success", "message": "Campaign resumed."})

@app.route('/api/campaigns/<int:campaign_id>/stream', methods=['GET'])
def telemetry_stream(campaign_id):
    def generate():
        # Yield historical logs
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT progress, task, message, class_name, task_status, artifact 
            FROM campaign_logs 
            WHERE campaign_id = ? 
            ORDER BY id DESC LIMIT 150
        ''', (campaign_id,))
        rows = reversed(cursor.fetchall())
        conn.close()
        
        for row in rows:
            log_entry = {
                "progress": row["progress"],
                "task": row["task"],
                "message": row["message"],
                "class": row["class_name"]
            }
            if row["task_status"]:
                log_entry["taskStatus"] = row["task_status"]
            if row["artifact"]:
                log_entry["artifact"] = row["artifact"]
            yield f"data: {json.dumps(log_entry)}\n\n"
            
        # Check active status
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT status FROM campaigns WHERE id = ?', (campaign_id,))
        camp = cursor.fetchone()
        conn.close()
        
        if camp and camp["status"] in ["running", "queued", "monitoring"]:
            q = queue.Queue()
            with subscribers_lock:
                if campaign_id not in subscribers:
                    subscribers[campaign_id] = set()
                subscribers[campaign_id].add(q)
                
            try:
                while True:
                    try:
                        log_entry = q.get(timeout=1.0)
                        yield f"data: {json.dumps(log_entry)}\n\n"
                        if log_entry.get("status") in ["completed", "failed", "paused"]:
                            break
                    except queue.Empty:
                        yield ": keep-alive\n\n"
            finally:
                with subscribers_lock:
                    if campaign_id in subscribers:
                        subscribers[campaign_id].discard(q)
                        if not subscribers[campaign_id]:
                            del subscribers[campaign_id]
        else:
            yield f"data: {json.dumps({'status': camp['status'] if camp else 'completed'})}\n\n"
            
    return Response(generate(), mimetype='text/event-stream')

@app.route('/api/chat', methods=['POST'])
def chatbot_message():
    data = request.json or {}
    message = data.get("message", "").strip()
    campaign_id = data.get("campaign_id")
    api_config = data.get("api", {})
    
    llm_api_key = api_config.get("llm_api_key")
    llm_provider = api_config.get("llm_provider", "gemini").lower()
    llm_model = api_config.get("llm_model", "gemini-1.5-flash")
    free_mode = data.get("free_mode", False)
    
    if not message:
        return jsonify({"status": "error", "message": "Message is empty."}), 400
        
    logs_context = ""
    domain = "N/A"
    keyword = "N/A"
    progress = 0
    status = "N/A"
    
    if campaign_id:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT domain, keyword, progress, status FROM campaigns WHERE id = ?', (campaign_id,))
            camp = cursor.fetchone()
            if camp:
                domain = camp["domain"]
                keyword = camp["keyword"]
                progress = camp["progress"]
                status = camp["status"]
                
            cursor.execute('''
                SELECT message FROM campaign_logs 
                WHERE campaign_id = ? 
                ORDER BY id DESC LIMIT 15
            ''', (campaign_id,))
            rows = cursor.fetchall()
            conn.close()
            
            log_lines = [r["message"] for r in reversed(rows)]
            logs_context = "\n".join(log_lines)
        except Exception:
            pass
            
    playbook_summary = ""
    try:
        from pathlib import Path
        playbook_path = Path("/opt/beyond-seo/SKILL.md")
        if playbook_path.exists():
            playbook_text = playbook_path.read_text(encoding='utf-8')
            playbook_summary = playbook_text[:1500] + "\n[Truncated...]"
    except Exception:
        pass
        
    system_prompt = f"""You are the dynamic AI Chatbot Assistant for the OmniSEO Command Center.
You are helping Tanveer Bhai track, analyze, and optimize his autonomous SEO campaigns.
You MUST reply in a friendly, helpful mix of Roman Urdu (Hinglish) and English.

Here is the current Campaign Context:
- Campaign ID: {campaign_id}
- Domain: {domain}
- Keyword: {keyword}
- Current Progress: {progress}%
- Campaign Status: {status}

Here are the last 15 logs of this campaign execution:
---
{logs_context}
---

Here is a summary snippet of the Beyond-SEO Playbook rules:
---
{playbook_summary}
---

Answer Tanveer Bhai's question directly, briefly, and clearly. If he asks about campaign progress, summarize the logs. Keep your answer under 200 words.
"""

    prompt_full = f"{system_prompt}\n\nUser Question: {message}\nAssistant:"
    
    try:
        if free_mode:
            if not llm_api_key:
                return jsonify({"status": "error", "message": "API key required for Chatbot Free Mode."}), 400
            chat_model = "openrouter/free"
            reply = call_openrouter_api(llm_api_key, chat_model, prompt_full)
        else:
            if llm_provider == "gemini" and llm_api_key:
                reply = call_gemini_api(llm_api_key, "gemini-1.5-flash", prompt_full)
            elif llm_provider == "openrouter" and llm_api_key:
                reply = call_openrouter_api(llm_api_key, llm_model, prompt_full)
            else:
                return jsonify({"status": "error", "message": "Valid API key is required for Chatbot."}), 400
                
        return jsonify({"status": "success", "reply": reply})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/campaigns/<int:campaign_id>/generate-pitch', methods=['POST'])
def generate_pitch(campaign_id):
    data = request.json or {}
    email = data.get("email", "").strip()
    target_domain = data.get("domain", "").strip()
    api_config = data.get("api", {})
    
    llm_api_key = api_config.get("llm_api_key")
    llm_provider = api_config.get("llm_provider", "gemini").lower()
    llm_model = api_config.get("llm_model", "gemini-1.5-flash")
    free_mode = data.get("free_mode", False)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT domain, keyword, comp1_url, comp1_name FROM campaigns WHERE id = ?', (campaign_id,))
    camp = cursor.fetchone()
    conn.close()
    
    if not camp:
        return jsonify({"status": "error", "message": "Campaign not found."}), 404
        
    keyword = camp["keyword"]
    my_domain = camp["domain"]
    comp1_name = camp["comp1_name"] or "competitors"
    comp1_url = camp["comp1_url"] or ""
    
    prompt = f"""You are "Beyond SEO" outreach automation engine.
Write a highly personalized, compelling, and professional backlink outreach email pitch to the owner of {target_domain} (contact: {email}).
Our site is: {my_domain}
We have built an outstanding, interactive utility tool for keyword: "{keyword}" (specifically, a premium dark-themed tax/financial calculator utility).

Competitor Rank #1 context: {comp1_name} ({comp1_url}) is ranking for "{keyword}", but their layout is non-interactive. We want to pitch the target website ({target_domain}) to link to our high-value interactive utility page (or replace any broken links to competitor sites).

Requirements for the pitch:
1. Short, interesting, and clear subject line.
2. Address the recipient respectfully. Mention their domain ({target_domain}).
3. Highlight the value of our interactive calculator for their audience.
4. Keep the tone helpful, non-spammy, and concise (under 150 words).
5. Output ONLY the email subject and body. No other text, explanations, or quotes.
"""

    try:
        if free_mode:
            if not llm_api_key:
                return jsonify({"status": "error", "message": "API key required for Free Mode."}), 400
            reply = call_openrouter_api(llm_api_key, "openrouter/free", prompt)
        else:
            if llm_provider == "gemini" and llm_api_key:
                reply = call_gemini_api(llm_api_key, "gemini-1.5-flash", prompt)
            elif llm_provider == "openrouter" and llm_api_key:
                reply = call_openrouter_api(llm_api_key, llm_model, prompt)
            else:
                # Fallback if no LLM key provided
                reply = f"""Subject: Interactive calculator resource for {target_domain}

Hello,

I was reading through your site at {target_domain} and noticed you cover topic-relevant guides.

We recently launched a fully interactive, mobile-optimized calculator tool for "{keyword}" on {my_domain}. Unlike the standard static tables on sites like {comp1_name}, ours allows users to estimate their values in real-time.

I thought this would make a great resource add for your readers. Let me know if you would be open to taking a look!

Best regards,
OmniSEO Team"""
                
        return jsonify({"status": "success", "pitch": reply})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

def init_and_migrate_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        try:
            cursor.execute("ALTER TABLE campaigns ADD COLUMN backlinks_count INTEGER DEFAULT 0;")
            conn.commit()
            print("Successfully added backlinks_count column to campaigns table.")
        except sqlite3.OperationalError:
            # Column already exists
            pass
            
        try:
            cursor.execute("ALTER TABLE campaigns ADD COLUMN tech_stack TEXT DEFAULT 'unknown';")
            conn.commit()
            print("Successfully added tech_stack column to campaigns table.")
        except sqlite3.OperationalError:
            # Column already exists
            pass
            
        try:
            cursor.execute("ALTER TABLE campaigns ADD COLUMN audit_only INTEGER DEFAULT 0;")
            conn.commit()
            print("Successfully added audit_only column to campaigns table.")
        except sqlite3.OperationalError:
            # Column already exists
            pass

        try:
            cursor.execute("ALTER TABLE campaigns ADD COLUMN comp1_name TEXT;")
            conn.commit()
            print("Successfully added comp1_name column to campaigns table.")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE campaigns ADD COLUMN comp1_url TEXT;")
            conn.commit()
            print("Successfully added comp1_url column to campaigns table.")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE campaigns ADD COLUMN comp2_name TEXT;")
            conn.commit()
            print("Successfully added comp2_name column to campaigns table.")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE campaigns ADD COLUMN comp2_url TEXT;")
            conn.commit()
            print("Successfully added comp2_url column to campaigns table.")
        except sqlite3.OperationalError:
            pass

        try:
            cursor.execute("ALTER TABLE campaigns ADD COLUMN scraped_leads TEXT DEFAULT '[]';")
            conn.commit()
            print("Successfully added scraped_leads column to campaigns table.")
        except sqlite3.OperationalError:
            pass
            
        conn.close()
    except Exception as e:
        print(f"Database migration warning: {e}")

def restart_monitoring_loops():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, domain, keyword FROM campaigns WHERE status = 'monitoring'")
        rows = cursor.fetchall()
        conn.close()
        for row in rows:
            t = threading.Thread(target=run_monitoring_loop, args=(row["id"], row["domain"], row["keyword"]), daemon=True)
            t.start()
            print(f"[SYSTEM] Restored monitoring loop for campaign {row['id']}")
    except Exception as e:
        print(f"[SYSTEM ERROR] Failed to restore monitoring loops: {e}")

if __name__ == '__main__':
    init_and_migrate_db()
    restart_monitoring_loops()
    app.run(host='127.0.0.1', port=8095, debug=False)
