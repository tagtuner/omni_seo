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
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def dispatch_log(campaign_id, log_data):
    with subscribers_lock:
        if campaign_id in subscribers:
            for q in subscribers[campaign_id]:
                q.put(log_data)

def save_log_to_db(campaign_id, progress, task, message, class_name, task_status=None, artifact=None, backlinks_count=None, tech_stack=None, comp1_name=None, comp1_url=None, comp2_name=None, comp2_url=None):
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
        
    dispatch_log(campaign_id, log_entry)

def update_campaign_status(campaign_id, status=None, progress=None, artifact_html=None, backlinks_count=None, tech_stack=None, comp1_name=None, comp1_url=None, comp2_name=None, comp2_url=None):
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
        
    if updates:
        params.append(campaign_id)
        query = f"UPDATE campaigns SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
    conn.close()

def run_campaign_wrapper(campaign_id, config):
    try:
        update_campaign_status(campaign_id, status='running', progress=0, backlinks_count=0, tech_stack='unknown')
        
        def log_callback(progress, task, message, class_name="terminal-info-msg", taskStatus=None, artifact=None, backlinks_count=None, tech_stack=None, comp1_name=None, comp1_url=None, comp2_name=None, comp2_url=None):
            save_log_to_db(campaign_id, progress, task, message, class_name, taskStatus, artifact, backlinks_count, tech_stack, comp1_name, comp1_url, comp2_name, comp2_url)
            update_campaign_status(campaign_id, progress=progress, artifact_html=artifact, backlinks_count=backlinks_count, tech_stack=tech_stack, comp1_name=comp1_name, comp1_url=comp1_url, comp2_name=comp2_name, comp2_url=comp2_url)
                
            if taskStatus == "completed" and task == "offpage":
                update_campaign_status(campaign_id, status='completed', progress=100)
                
        # Run pipeline
        success, message = run_campaign_pipeline(config, log_callback)
        if success:
            save_log_to_db(campaign_id, 100, "offpage", "SYSTEM: Campaign completed successfully.", "terminal-success-msg", "completed")
            update_campaign_status(campaign_id, status='completed', progress=100)
        else:
            save_log_to_db(campaign_id, 100, "offpage", f"SYSTEM: Campaign finished with errors: {message}", "terminal-error-msg", "completed")
            update_campaign_status(campaign_id, status='failed', progress=100)
            
    except Exception as e:
        save_log_to_db(campaign_id, 100, "offpage", f"SYSTEM ERROR: Campaign failed: {str(e)}", "terminal-error-msg", "completed")
        update_campaign_status(campaign_id, status='failed', progress=100)
    finally:
        dispatch_log(campaign_id, {"status": "completed"})

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
        SELECT id, domain, keyword, duration, prompt, status, progress, created_at, artifact_html, backlinks_count, tech_stack, audit_only, comp1_name, comp1_url, comp2_name, comp2_url
        FROM campaigns
        ORDER BY id DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    
    campaigns = []
    for r in rows:
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
            "comp2_url": r["comp2_url"] if "comp2_url" in r.keys() else None
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
            ORDER BY id ASC
        ''', (campaign_id,))
        rows = cursor.fetchall()
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
        
        if camp and camp["status"] in ["running", "queued"]:
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
                        if log_entry.get("status") == "completed" or (log_entry.get("taskStatus") == "completed" and log_entry.get("task") == "offpage"):
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
            yield f"data: {json.dumps({'status': 'completed'})}\n\n"
            
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
            
        conn.close()
    except Exception as e:
        print(f"Database migration warning: {e}")

if __name__ == '__main__':
    init_and_migrate_db()
    app.run(host='127.0.0.1', port=8095, debug=False)
